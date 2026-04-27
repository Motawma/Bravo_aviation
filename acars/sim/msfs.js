const { open: simOpen, Protocol, SimConnectPeriod, SimConnectDataType } = require('node-simconnect');

const SIM_VARS = [
  { name: 'PLANE LATITUDE',                  unit: 'degrees',         type: SimConnectDataType.FLOAT64 },
  { name: 'PLANE LONGITUDE',                 unit: 'degrees',         type: SimConnectDataType.FLOAT64 },
  { name: 'PLANE ALTITUDE',                  unit: 'feet',            type: SimConnectDataType.FLOAT64 },
  { name: 'AIRSPEED INDICATED',              unit: 'knots',           type: SimConnectDataType.FLOAT64 },
  { name: 'VERTICAL SPEED',                  unit: 'feet per minute', type: SimConnectDataType.FLOAT64 },
  { name: 'PLANE HEADING DEGREES TRUE',      unit: 'degrees',         type: SimConnectDataType.FLOAT64 },
  { name: 'FUEL TOTAL QUANTITY',             unit: 'gallons',         type: SimConnectDataType.FLOAT64 },
  { name: 'SIM ON GROUND',                   unit: 'bool',            type: SimConnectDataType.INT32   },
  { name: 'LIGHT LANDING',                   unit: 'bool',            type: SimConnectDataType.INT32   },
  { name: 'TRANSPONDER CODE:1',              unit: 'number',          type: SimConnectDataType.INT32   },
  { name: 'PLANE TOUCHDOWN NORMAL VELOCITY', unit: 'feet per minute', type: SimConnectDataType.FLOAT64 },
  // Motores
  { name: 'ENGINE COMBUSTION:1',             unit: 'bool',            type: SimConnectDataType.INT32   },
  { name: 'ENGINE COMBUSTION:2',             unit: 'bool',            type: SimConnectDataType.INT32   },
  // Luzes
  { name: 'LIGHT BEACON',                    unit: 'bool',            type: SimConnectDataType.INT32   },
  { name: 'LIGHT STROBE',                    unit: 'bool',            type: SimConnectDataType.INT32   },
  { name: 'LIGHT NAV',                       unit: 'bool',            type: SimConnectDataType.INT32   },
  { name: 'LIGHT TAXI',                      unit: 'bool',            type: SimConnectDataType.INT32   },
  // Flaps e trem
  { name: 'FLAPS HANDLE INDEX',              unit: 'number',          type: SimConnectDataType.INT32   },
  { name: 'GEAR HANDLE POSITION',            unit: 'bool',            type: SimConnectDataType.INT32   },
];

const DEF_ID = 1;
const REQ_ID = 1;

class MSFSHandler {
  constructor() {
    this.connection = null;
    this.handle     = null;
    this.onData     = null;
    this.onStatus   = null;
    this._lastTouchdownVS = 0;
  }

  async connect() {
    return new Promise(async (resolve, reject) => {
      try {
        const result = await simOpen('BravoACARS', Protocol.KittyHawk);
        this.handle = result.recvOpen;
        const conn  = result.handle;
        this.connection = conn;

        SIM_VARS.forEach((v) => {
          conn.addToDataDefinition(DEF_ID, v.name, v.unit, v.type);
        });

        conn.requestDataOnSimObject(REQ_ID, DEF_ID, 0, SimConnectPeriod.SECOND, 0, 0, 0, 0);

        conn.on('simObjectData', (packet) => {
          try {
            const d = packet.data;
            const lat      = d.readFloat64();
            const lon      = d.readFloat64();
            const alt      = d.readFloat64();
            const spd      = d.readFloat64();
            const vs       = d.readFloat64();
            const hdg      = d.readFloat64();
            const fuel     = d.readFloat64();
            const onGround = d.readInt32() !== 0;
            const lights   = d.readInt32() !== 0;
            const xpdr     = d.readInt32();
            const touchVS  = Math.abs(d.readFloat64());
            const eng1     = d.readInt32() !== 0;
            const eng2     = d.readInt32() !== 0;
            const beacon   = d.readInt32() !== 0;
            const strobe   = d.readInt32() !== 0;
            const nav      = d.readInt32() !== 0;
            const taxi     = d.readInt32() !== 0;
            const flapsIdx = d.readInt32();
            const gearDown = d.readInt32() !== 0;

            if (touchVS > 10) this._lastTouchdownVS = touchVS;

            this.onData && this.onData({
              lat, lon, alt, spd, vs, hdg, fuel,
              onGround,
              landingLights:   lights,
              transponderMode: xpdr,
              touchdownVS:     this._lastTouchdownVS,
              aircraft:        this._aircraftTitle || 'MSFS Aircraft',
              eng1, eng2,
              beaconLight: beacon,
              strobeLight: strobe,
              navLight:    nav,
              taxiLight:   taxi,
              flapsIndex:  flapsIdx,
              gearDown
            });
          } catch (_) {}
        });

        conn.addToDataDefinition(2, 'TITLE', null, SimConnectDataType.STRING256);
        conn.requestDataOnSimObject(2, 2, 0, SimConnectPeriod.ONCE, 0, 0, 0, 0);
        conn.on('simObjectDataByType', (packet) => {
          try {
            const title = packet.data.readString256();
            if (title) this._aircraftTitle = title;
          } catch (_) {}
        });

        conn.on('quit', () => {
          this.onStatus && this.onStatus({ connected: false, type: 'msfs' });
        });
        conn.on('exception', (ex) => {
          console.error('SimConnect exception:', ex.exception);
        });

        this.onStatus && this.onStatus({ connected: true, type: 'msfs' });
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  disconnect() {
    if (this.connection) {
      try { this.connection.close(); } catch (_) {}
      this.connection = null;
    }
  }
}

module.exports = MSFSHandler;
