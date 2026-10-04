# HyperDrive Live Bridge · F1 26

Puente **100 % efímero** entre la telemetría UDP de F1 26 y la pantalla `caster-live.html`.

## Qué hace

- Escucha F1 26 por UDP en el puerto **20777**.
- Interpreta Session, Participants, Lap Data, Motion, Car Status, Car Telemetry y Session History.
- Calcula en memoria los **20 microsectores**.
- Construye en memoria el trazado del circuito con las coordenadas de los coches.
- Conserva en RAM la Pole obtenida en Qualy para utilizarla durante la carrera.
- Envía el estado actual a la web mediante **Supabase Realtime Broadcast** a 10 Hz.

## Qué NO hace

- No escribe telemetría en PostgreSQL.
- No modifica resultados.
- No modifica campeonatos.
- No guarda vueltas, sectores, posiciones ni mapas.
- Al cerrar el bridge, la telemetría desaparece.

## Requisitos

- Windows, macOS o Linux con **Node.js 20 o superior**.
- El PC debe estar en la misma red que la consola/PC que ejecuta F1 26.

## Instalación

Desde esta carpeta:

```bash
npm install
npm start
```

## F1 26

En **Settings > Telemetry Settings**:

- UDP Telemetry: **On**
- UDP IP Address: **IP local del PC donde ejecutas el bridge**
- UDP Port: **20777**
- UDP Send Rate: **60 Hz** recomendado
- UDP Format: **2026**
- Show Online IDs / nombres online: activado si quieres que el Live Timing reciba los gamertags

El formato 2026 utiliza hasta 24 coches.

## Variables opcionales

```bash
UDP_PORT=20777
LIVE_ROOM=hyperdrive-live-v1
PUBLISH_HZ=10
```

La URL y la publishable key de Supabase son las mismas que usa la web y no son credenciales administrativas.

## Uso

1. Abre el bridge antes de Qualy.
2. Déjalo abierto durante Qualy y Carrera.
3. En el Área Personal entra en **Caster Live**.
4. Selecciona división y ronda.
5. La pantalla cambia automáticamente entre **Qualy** y **Carrera** según el tipo de sesión recibido por UDP.

Es recomendable mantener el bridge abierto entre Qualy y Carrera para que la Pole permanezca en memoria y pueda aplicarse al Mundial LIVE.
