# Partner XML feed

Dealers and marketplaces can send their stock as one XML document at a stable URL. The feed is a full snapshot: cars that disappear from it are removed from the site at the next import.

```xml
<CARS>
  <CAR>
    <ID>12345</ID>                      <!-- required, stable per car -->
    <URL>https://dealer.cz/car/12345</URL>  <!-- required, where buyers are sent -->
    <TITLE>Škoda Octavia Combi 2.0 TDI DSG</TITLE>
    <DESCRIPTION>Free text…</DESCRIPTION>
    <PRICE>289000</PRICE>
    <CURRENCY>CZK</CURRENCY>            <!-- CZK | EUR -->
    <MAKE>Škoda</MAKE>
    <MODEL>Octavia</MODEL>
    <YEAR>2018</YEAR>
    <MILEAGE>154000</MILEAGE>
    <FUEL>diesel</FUEL>                 <!-- petrol|diesel|lpg|cng|hybrid|plugin_hybrid|electric -->
    <TRANSMISSION>automatic</TRANSMISSION> <!-- manual|automatic -->
    <POWER_KW>110</POWER_KW>
    <CONDITION>ok</CONDITION>           <!-- ok|damaged|non_running|parts -->
    <VAT_DEDUCTIBLE>1</VAT_DEDUCTIBLE>
    <IMAGE>https://dealer.cz/photo/12345-1.jpg</IMAGE>
    <LOCATION>Brno</LOCATION>
    <POSTAL_CODE>60200</POSTAL_CODE>
  </CAR>
</CARS>
```

Structured fields win over what the parser reads from the text. Unknown fields are ignored. RSS 2.0 is also accepted (not treated as a snapshot).
