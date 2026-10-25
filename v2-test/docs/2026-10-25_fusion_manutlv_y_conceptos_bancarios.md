# HyperDrive — Fusión de Manutlv y descripción de movimientos bancarios

Fecha de ejecución: 25 de octubre de 2026.

## 1. Consolidación de Manu → Manutlv

Se realizó una fusión **directamente en Supabase y dentro de una transacción atómica**, tras una simulación íntegra con `ROLLBACK` y validaciones de integridad. Se conserva el ID de **Manutlv** y se elimina la fila de piloto incorrecta **Manu**.

### Datos conservados en Manutlv

- Cuenta real vinculada y su rol `pilot`.
- Contrato vigente de McLaren (Academy), incorporado en ronda 7 de T8: 20 M por media temporada, cláusula 30 M y vencimiento al final de T8.
- Historial de reserva de Aston Martin (rondas 5-6) y asiento oficial de McLaren desde ronda 7.
- Historial de la acción administrativa de alta contractual, incluido el identificador original de la acción, sus datos de reversión y el contrato.
- Las seis selecciones abiertas de HyperBet, con el nombre de presentación actualizado a `Manutlv`.
- Alias de resultados `Manutlv` (principal), `Manu` y `ATC M.lindes`, para conservar la asociación de nombres históricos.
- Su banco del piloto con un único bono de bienvenida de **5 M** y su superlicencia de T8 con **12 puntos**. Los registros duplicados de 5 M y de superlicencia de la ficha errónea se descartaron sin crear movimientos contables adicionales.

Se verificó que ningún saldo, cargo o salary cap de escuderías varió y que no se perdieron sanciones, apuestas realizadas ni eventos de superlicencia en la ficha descartada (no contenía tales eventos).

### Resultado

La búsqueda por `nickname='Manu'` ya no encuentra ningún piloto. El piloto vigente es exclusivamente **Manutlv (#3)**, que tiene la cuenta, el contrato, el asiento y las referencias deportivas consolidadas.

## 2. Conceptos bancarios descriptivos

Supabase implementa:

- `public.describe_contract_bank_movement(public.economic_transactions)`: genera un concepto que identifica al piloto, escuderías, motivo, importe, periodo, ronda, duración y referencia de acción.
- `public.set_contract_bank_movement_description()`: función de un trigger `BEFORE INSERT` en `public.economic_transactions`.
- Trigger `trg_contract_bank_movement_description`: en nuevos movimientos de `source_type='contract_mgmt:<uuid>'` aplica el formato antes de guardar el movimiento.
- Reetiquetado de las **21 transacciones previas** de contratos, sin tocar `amount_m`, `account_id`, `direction`, `transaction_date` o `source_type`.
- Una ampliación del formato de rescisión para detallar el **total pagado por el comprador** (contrato nuevo más cláusula) y el salary cap del contrato nuevo repartido entre temporadas.

Tipos incluidos: alta de contrato, ampliación, aumento de cláusula, fichaje pagando cláusula (gasto del comprador, ingreso del vendedor y nuevo contrato), rescisión voluntaria y devolución por asistencia.

Ejemplo conceptual — movimiento real registrado de Víctor, McLaren → Cadillac:

> Pago cláusula de rescisión · Piloto: Victor · McLaren → Cadillac · Cláusula: 30 M · Contrato nuevo: 50 M (media temporada) · Total pagado ahora por Cadillac: 80 M · T8, mitad 2, ronda 7

También hay una operación separada del comprador de 50 M por el contrato y otra del equipo vendedor de 30 M de ingreso por cláusula, ambas relacionadas con la misma acción.

**Migraciones aplicadas:**

1. `detailed_pilot_contract_bank_transaction_descriptions`.
2. `include_buyout_full_payment_and_cap_breakdown_in_bank`.

### Protección contable

Las mejoras bancarias cambian **únicamente el texto de descripción de movimientos existentes**; el trigger cambia ese mismo campo en futuras operaciones. No se vuelven a cobrar operaciones anteriores ni se alteran importes ni categorías. Las operaciones contractuales posteriores siguen usando el gestor normal de Supabase.

### Verificación realizada

- Simulación de la fusión bajo `BEGIN … ROLLBACK` con referencias y financieros controlados; ejecución definitiva bajo `COMMIT`.
- Consulta independiente posterior confirma la eliminación de `Manu`, contrato activo y seis selecciones de apuestas en `Manutlv`, con banco personal de 5 M.
- Los 21 movimientos de contratos anteriores quedaron reetiquetados con piloto y referencia.
- Inserción simulada y revertida de un movimiento bancario de cláusula confirmó que el trigger genera el nuevo concepto automáticamente.
