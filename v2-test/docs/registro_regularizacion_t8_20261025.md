# HyperDrive F1 League — Registro de regularización de contratos T8

**Fecha:** 25 de octubre de 2026  
**Estado:** aplicado y verificado en Supabase (producción).  
**Ámbito:** 21 contratos heredados sin periodizar; Administración confirmó vencimiento al final de la temporada 8.

## Contratos procesados

Cantidades en millones (M) de la moneda HyperDrive.

| Escudería | Piloto | Valor | Cláusula | Inicio | Fin |
|---|---|---:|---:|---|---|
| Aston Martin | Cachii | 195,00 | 292,50 | Inicio T8 | Final T8 |
| Aston Martin | RJerez | 37,00 | 55,50 | Inicio T8 | Final T8 |
| Audi | CarAscari | 55,00 | 82,50 | Inicio T8 | Final T8 |
| Audi | Kevin | 40,00 | 60,00 | Inicio T8 | Final T8 |
| Audi | Venegas | 195,00 | 292,50 | Inicio T8 | Final T8 |
| Cadillac | German | 180,00 | 270,00 | Inicio T8 | Final T8 |
| Ferrari | Jaime | 130,00 | 195,00 | Inicio T8 | Final T8 |
| Ferrari | SincDex | 43,00 | 64,50 | Inicio T8 | Final T8 |
| Ferrari | Vrister | 43,00 | 64,50 | Inicio T8 | Final T8 |
| Haas | Ivanition | 130,00 | 195,00 | Inicio T8 | Final T8 |
| McLaren | SergiMarquez | 475,00 | 712,50 | Inicio T8 | Final T8 |
| McLaren | Victor | 20,00 | 30,00 | Inicio T8 | Final T8 |
| Mercedes | Eriknight | 67,00 | 100,50 | Inicio T8 | Final T8 |
| Mercedes | LaXavineta | 100,00 | 150,00 | Inicio T8 | Final T8 |
| Mercedes | Lewton | 200,00 | 300,00 | Inicio T8 | Final T8 |
| Racing Bulls | Sergi6gm | 50,00 | 75,00 | Inicio T8 | Final T8 |
| Racing Bulls | Serginho | 161,60 | 242,40 | Inicio T8 | Final T8 |
| Red Bull | GranBoss | 23,30 | 34,95 | Inicio T8 | Final T8 |
| Red Bull | Raul | 320,00 | 480,00 | Inicio T8 | Final T8 |
| Williams | Zanfer | 149,00 | 223,50 | Inicio T8 | Final T8 |
| Williams | Zarba | 190,00 | 285,00 | Mitad T8 | Final T8 |

## Casos particulares

- **Victor (McLaren):** su registro heredado indicaba tres medias temporadas restantes. Administración confirmó el final de T8, por lo que se ajustó a dos medias temporadas, conservando valor 20 M y cláusula 30 M.
- **Zarba (Williams):** se integró solo la segunda mitad de T8 (periodo 17) por ser la única media temporada restante.
- **Sunsurfer (Alpine)** y **Kolakao (Haas):** ya habían sido regularizados; no se duplicaron ni alteraron.

## Implementación y validación

- Se utilizó `public.admin_contract_apply`, `kind = 'import'`, con importe cero.
- Los 21 contratos se integraron en una sola transacción atómica tras una simulación revertida.
- Se confirmó que no hubo variaciones de valores contractuales, cláusulas, estados, saldos, salary cap ni movimientos económicos.
- No se modificaron los asientos del campeonato ni el historial de carreras.
- Verificación posterior: **33 contratos activos de pilotos no exentos con periodos configurados y cero pendientes**.
- Los demás contratos vigentes con vencimientos diferentes del final de T8 no se tocaron.

Este archivo es un registro de auditoría de cambios **ya ejecutados en Supabase**. El commit no vuelve a aplicar cambios sobre la base de datos.
