import { describe, expect, it } from "vitest";
import { parseListing } from "@/parser/extract";

const now = new Date("2026-10-07T12:00:00Z");
const p = (title: string, description = "", price: number | null = 150000) =>
  parseListing({ title, description, price, currency: "CZK", now });

describe("make & model", () => {
  it("reads make and model from the title", () => {
    const r = p("Škoda Octavia Combi 2.0 TDI 110kW DSG");
    expect(r.make).toBe("skoda");
    expect(r.model).toBe("octavia");
    expect(r.fuel).toBe("diesel");
    expect(r.powerKw).toBe(110);
    expect(r.transmission).toBe("automatic");
    expect(r.bodyType).toBe("combi");
    expect(r.engineCcm).toBe(2000);
  });
  it("infers the make from a distinctive model name", () => {
    const r = p("Prodám Octavii 1.9 TDI, r.v. 2008");
    expect(r.make).toBe("skoda");
    expect(r.model).toBe("octavia");
    expect(r.year).toBe(2008);
  });
  it("maps BMW engine codes to the series", () => {
    const r = p("BMW 320d xDrive Touring", "Najeto 210 tis. km, automat");
    expect(r.make).toBe("bmw");
    expect(r.model).toBe("3-series");
    expect(r.fuel).toBe("diesel");
    expect(r.mileageKm).toBe(210000);
    expect(r.bodyType).toBe("combi");
  });
  it("maps Mercedes type codes", () => {
    const r = p("Mercedes-Benz E 220 CDI Avantgarde");
    expect(r.make).toBe("mercedes-benz");
    expect(r.model).toBe("e-class");
  });
  it("prefers the more specific model alias", () => {
    expect(p("Land Rover Range Rover Sport 3.0 SDV6").model).toBe("range-rover-sport");
    expect(p("Jeep Grand Cherokee 3.0 CRD").model).toBe("grand-cherokee");
  });
  it("handles VW abbreviation", () => {
    const r = p("VW Passat B8 variant 2.0tdi 140kw");
    expect(r.make).toBe("volkswagen");
    expect(r.model).toBe("passat");
    expect(r.powerKw).toBe(140);
  });
});

describe("year", () => {
  it("ignores STK dates and picks the production year", () => {
    const r = p("Ford Focus 1.6", "Rok výroby 2011, STK do 05/2027, servis 2024.");
    expect(r.year).toBe(2011);
    expect(r.stkValidUntil).toBe("2027-05");
  });
  it("does not read engine displacement as a year", () => {
    const r = p("Opel Astra 1998 ccm", "r.v. 2004");
    expect(r.year).toBe(2004);
    expect(r.engineCcm).toBe(1998);
  });
  it("accepts first registration month/year", () => {
    expect(p("Kia Ceed", "1. registrace 03/2016, najeto 98 000 km").year).toBe(2016);
  });
  it("ignores 'vlastním od 2019'", () => {
    expect(p("Toyota Yaris", "Vlastním od roku 2019, vyrobeno 2009").year).toBe(2009);
  });
});

describe("mileage", () => {
  it("reads tkm and tis. km", () => {
    expect(p("Hyundai i30 1.4 CVVT, 145tkm").mileageKm).toBe(145000);
    expect(p("Fabia", "najeto 185 tis. km").mileageKm).toBe(185000);
  });
  it("ignores service intervals", () => {
    const r = p("Superb 2.0 TDI", "Rozvody měněny při 180 000 km, najeto 245 000 km.");
    expect(r.mileageKm).toBe(245000);
  });
  it("ignores EV range", () => {
    const r = p("Tesla Model 3 Long Range", "Dojezd 560 km, najeto 60 000 km, baterie 75 kWh");
    expect(r.mileageKm).toBe(60000);
    expect(r.fuel).toBe("electric");
    expect(r.engineCcm).toBeNull();
  });
  it("reads keyword-first mileage without unit", () => {
    expect(p("Golf 6", "najeto 156 000, nová STK").mileageKm).toBe(156000);
  });
});

describe("condition", () => {
  it("treats negated accident words as positive", () => {
    const r = p("Škoda Superb 2.0 TDI", "Auto je nehavarované, nikdy nebourané, bez koroze, servisní knížka.");
    expect(r.condition).toBe("ok");
    expect(r.serviceBook).toBe(true);
  });
  it("detects non-running cars", () => {
    expect(p("VW Golf 1.9 TDI nepojízdné", "Motor nestartuje.").condition).toBe("non_running");
    expect(p("Octavia 1.6", "Zadřený motor, jinak dobrý stav.").condition).toBe("non_running");
  });
  it("detects whole cars sold for parts", () => {
    const r = p("Renault Megane 1.5 dCi na díly");
    expect(r.kind).toBe("car");
    expect(r.condition).toBe("parts");
  });
  it("detects damaged cars", () => {
    expect(p("Audi A4 Avant", "Lehce bouraný předek, motor ok.").condition).toBe("damaged");
    expect(p("Kia Sportage", "Po havárii, airbagy v pořádku").condition).toBe("damaged");
  });
  it("does not flag 'není bouraná'", () => {
    expect(p("Mazda 6", "Auto není bourané a jezdí bez problémů.").condition).toBe("ok");
  });
  it("Slovak: nehavarované, pojazdné", () => {
    const r = p("Škoda Fabia 1.2 HTP", "Auto je plne pojazdné, nebolo búrané, najazdené 120 000 km, rok výroby 2010");
    expect(r.condition).toBe("ok");
    expect(r.mileageKm).toBe(120000);
    expect(r.year).toBe(2010);
    expect(r.fuel).toBe("petrol");
  });
});

describe("listing kind", () => {
  it("recognises parts listings", () => {
    expect(p("Alu kola 16\" 5x112 Octavia", "", 6000).kind).toBe("parts");
    expect(p("Motor 1.9 TDI 77kW BXE", "", 15000).kind).toBe("parts");
    expect(p("Díly z Fabia 1.2", "", 500).kind).toBe("parts");
  });
  it("recognises wanted and rental ads", () => {
    expect(p("Koupím Škoda Octavia, i nepojízdnou").kind).toBe("wanted");
    expect(p("Pronájem dodávky Ford Transit").kind).toBe("rental");
  });
  it("flags placeholder prices", () => {
    const r = p("Škoda Kodiaq 2.0 TDI 4x4 r.v. 2020", "", 1);
    expect(r.priceSuspicious).toBe(true);
  });
});

describe("seller & extras", () => {
  it("detects dealers", () => {
    const r = p("Škoda Karoq 1.5 TSI", "Možnost odpočtu DPH, financování na splátky, AUTOBAZAR Praha.");
    expect(r.seller).toBe("dealer");
    expect(r.vatDeductible).toBe(true);
  });
  it("detects private sellers", () => {
    expect(p("Fabia 1.4", "Prodávám svoje auto z důvodu koupě nového, 1. majitel.").seller).toBe("private");
  });
  it("converts horsepower", () => {
    expect(p("Seat Leon 1.4 TSI 150 PS").powerKw).toBe(110);
  });
  it("detects LPG on petrol cars", () => {
    expect(p("Octavia 1.6 MPI + LPG").fuel).toBe("lpg");
  });
});

describe("confidence", () => {
  it("is high for complete ads and low for vague ones", () => {
    expect(p("Škoda Octavia 2.0 TDI 2015", "Najeto 180 000 km, nehavarované").confidence).toBeGreaterThan(0.85);
    expect(p("Prodám auto", "Volejte").confidence).toBeLessThan(0.3);
  });
});

describe("regressions from demo data", () => {
  it("negative concord: 'nikdy nebourané' is positive", () => {
    expect(p("Golf", "Nikdy nebourané, garážované.").condition).toBe("ok");
  });
  it("inflected positive phrases", () => {
    expect(p("Golf", "Vůz je v top stavu, pravidelný servis.").condition).toBe("ok");
    expect(p("Golf", "Vozidlo je v top stave.").condition).toBe("ok");
  });
  it("hail damage stays damaged even when technically fine", () => {
    expect(p("Golf", "Poškozené kroupami, technicky v pořádku.").condition).toBe("damaged");
  });
  it("Tesla defaults to electric", () => {
    expect(p("Tesla Model 3 Long Range AWD").fuel).toBe("electric");
  });
});
