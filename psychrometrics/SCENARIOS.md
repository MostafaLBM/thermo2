# Process scenarios

End states are illustrative teaching cases, not equipment ratings.

| Scenario | State 1 | State 2 |
|---|---|---|
| Cooling and dehumidification, AHU coil | 28 degC, 60 % RH | 13 degC, 95 % RH |
| Sensible cooling, dry coil | 35 degC, 30 % RH | 22 degC, same W |
| Sensible heating, winter preheat | 2 degC, 80 % RH | 24 degC, same W |
| Heating and humidification | 5 degC, 50 % RH | 22 degC, 45 % RH |
| Evaporative cooling, direct | 38 degC, 20 % RH | effectiveness 0.85, on inlet wet-bulb line |
| Steam humidification | 21 degC, 20 % RH | 21 degC, 45 % RH |
| Desiccant dehumidification | 30 degC, 60 % RH | inlet enthalpy, W = 10.5 g/kg |

Sensible heat ratio is not reported for (near-)adiabatic processes, where total
enthalpy change is small compared with the sensible and latent parts.

## Duct mode presets

| Scenario | Inlet | Components in airflow order |
|---|---|---|
| Empty duct | 30 degC, 60 % RH | none |
| Summer, cooling coil | 30 degC, 60 % RH | cooling coil 8 degC, BF 0.20 |
| Summer, cooling coil + reheat | 30 degC, 60 % RH | cooling coil 8 degC, BF 0.20; heating coil 25 degC, BF 0.30 |
| Winter, heating coil + steam | 10 degC, 30 % RH | heating coil 35 degC, BF 0.30; steam 100 degC, 4 g/kg |
| Winter, heating coil + water spray | 10 degC, 30 % RH | heating coil 40 degC, BF 0.20; water 15 degC, 5 g/kg |
