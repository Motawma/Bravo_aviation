const { open: simOpen, Protocol, SimConnectPeriod, SimConnectDataType } = require('node-simconnect');

// PLANE TOUCHDOWN NORMAL VELOCITY removida — causava erro 7 (NAME_UNRECOGNIZED).
// ENGINE COMBUSTION corrigida para ENG COMBUSTION (nome correto no SDK).
// Touchdown VS calculado do VERTICAL SPEED no frame anterior ao toque.
const SIM_VARS = [
  { name: 'PLANE LATITUDE',             unit: 'degrees',         type: SimConnectDataType.FLOAT64 },
  { name: 'PLANE LONGITUDE',            unit: 'degrees',         type: SimConnectDataType.FLOAT64 },
  { name: 'INDICATED ALTITUDE',         unit: 'feet',            type: SimConnectDataType.FLOAT64 },
  { name: 'AIRSPEED INDICATED',         unit: 'knots',           type: SimConnectDataType.FLOAT64 },
  { name: 'VERTICAL SPEED',             unit: 'feet per minute', type: SimConnectDataType.FLOAT64 },
  { name: 'PLANE HEADING DEGREES MAGNETIC', unit: 'degrees',      type: SimConnectDataType.FLOAT64 },
  { name: 'FUEL TOTAL QUANTITY',        unit: 'gallons',         type: SimConnectDataType.FLOAT64 },
  { name: 'SIM ON GROUND',              unit: 'bool',            type: SimConnectDataType.INT32   },
  { name: 'LIGHT LANDING',              unit: 'bool',            type: SimConnectDataType.INT32   },
  { name: 'TRANSPONDER CODE:1',         unit: 'number',          type: SimConnectDataType.INT32   },
  // Motores
  { name: 'ENG COMBUSTION:1',           unit: 'bool',            type: SimConnectDataType.INT32   },
  { name: 'ENG COMBUSTION:2',           unit: 'bool',            type: SimConnectDataType.INT32   },
  // Luzes
  { name: 'LIGHT BEACON',               unit: 'bool',            type: SimConnectDataType.INT32   },
  { name: 'LIGHT STROBE',               unit: 'bool',            type: SimConnectDataType.INT32   },
  { name: 'LIGHT NAV',                  unit: 'bool',            type: SimConnectDataType.INT32   },
  { name: 'LIGHT TAXI',                 unit: 'bool',            type: SimConnectDataType.INT32   },
  // Flaps e trem
  { name: 'FLAPS HANDLE INDEX',         unit: 'number',          type: SimConnectDataType.INT32   },
  { name: 'GEAR HANDLE POSITION',       unit: 'bool',            type: SimConnectDataType.INT32   },
  // FOQA
  { name: 'PLANE ALT ABOVE GROUND',     unit: 'feet',            type: SimConnectDataType.FLOAT64 },
  { name: 'G FORCE',                    unit: 'number',          type: SimConnectDataType.FLOAT64 },
  { name: 'SIMULATION RATE',            unit: 'number',          type: SimConnectDataType.FLOAT64 },
  { name: 'TOTAL WEIGHT',               unit: 'kilograms',       type: SimConnectDataType.FLOAT64 },
  { name: 'FUEL TOTAL QUANTITY WEIGHT', unit: 'kilograms',       type: SimConnectDataType.FLOAT64 },
  { name: 'SPOILERS HANDLE POSITION',   unit: 'number',          type: SimConnectDataType.FLOAT64 },
  { name: 'STALL WARNING',              unit: 'bool',            type: SimConnectDataType.INT32   },
  { name: 'OVERSPEED WARNING',          unit: 'bool',            type: SimConnectDataType.INT32   },
  { name: 'PLANE BANK DEGREES',         unit: 'degrees',         type: SimConnectDataType.FLOAT64 },
  { name: 'AMBIENT WIND DIRECTION',     unit: 'degrees',         type: SimConnectDataType.FLOAT64 },
  { name: 'AMBIENT WIND VELOCITY',      unit: 'knots',           type: SimConnectDataType.FLOAT64 },
  { name: 'BRAKE PARKING INDICATOR',    unit: 'bool',            type: SimConnectDataType.INT32   },
];

const DEF_ID = 1;
const REQ_ID = 1;

class MSFSHandler {
  constructor() {
    this.connection       = null;
    this.handle           = null;
    this.onData           = null;
    this.onStatus         = null;
    this._lastTouchdownVS = 0;
    this._prevVS          = 0;
    this._prevOnGround    = false;
    this._aircraftTitle   = null;
  }

  async connect() {
    return new Promise(async (resolve, reject) => {
      try {
        const result = await simOpen('BravoACARS', Protocol.KittyHawk);
        this.handle = result.recvOpen;
        const conn  = result.handle;
        this.connection = conn;

        conn.on('quit', () => {
          this.onStatus && this.onStatus({ connected: false, type: 'msfs' });
        });

        conn.on('exception', (ex) => {
          const code = ex.exception ?? ex.dwException ?? '?';
          console.error('SimConnect exception:', code, ex);
          this.onData && this.onData({ _simException: code, _simExIndex: '?', _simExVar: '?' });
        });

        this.onStatus && this.onStatus({ connected: true, type: 'msfs' });
        resolve();

        setTimeout(() => {
          if (!this.connection) return;

          SIM_VARS.forEach((v) => {
            conn.addToDataDefinition(DEF_ID, v.name, v.unit, v.type);
          });

          conn.requestDataOnSimObject(REQ_ID, DEF_ID, 0, SimConnectPeriod.SECOND, 0, 0, 0, 0);

          conn.on('simObjectData', (packet) => {
            if (packet.requestID === REQ_ID) {
              try {
                const d = packet.data;
                const lat       = d.readFloat64();
                const lon       = d.readFloat64();
                const alt       = d.readFloat64();
                const spd       = d.readFloat64();
                const vs        = d.readFloat64();
                const hdg       = ((d.readFloat64()) % 360 + 360) % 360;
                const fuel      = d.readFloat64();
                const onGround  = d.readInt32() !== 0;
                const lights    = d.readInt32() !== 0;
                const xpdr      = d.readInt32();
                const eng1      = d.readInt32() !== 0;
                const eng2      = d.readInt32() !== 0;
                const beacon    = d.readInt32() !== 0;
                const strobe    = d.readInt32() !== 0;
                const nav       = d.readInt32() !== 0;
                const taxi      = d.readInt32() !== 0;
                const flapsIdx  = d.readInt32();
                const gearDown  = d.readInt32() !== 0;
                const altAgl    = d.readFloat64();
                const gForce    = d.readFloat64();
                const simRate   = d.readFloat64();
                const totalKg   = d.readFloat64();
                const fuelKg    = d.readFloat64();
                const spoilers  = d.readFloat64();
                const stallWarn = d.readInt32() !== 0;
                const ovspWarn  = d.readInt32() !== 0;
                const bankDeg   = d.readFloat64();
                const windDir   = d.readFloat64();
                const windSpd   = d.readFloat64();
                const parkingBrake = d.readInt32() !== 0;

                if (!this._prevOnGround && onGround) {
                  this._lastTouchdownVS = Math.abs(this._prevVS || vs);
                }
                this._prevVS       = vs;
                this._prevOnGround = onGround;

                this.onData && this.onData({
                  lat, lon, alt, spd, vs, hdg, fuel,
                  onGround,
                  landingLights:    lights,
                  transponderMode:  xpdr,
                  touchdownVS:      this._lastTouchdownVS,
                  aircraft:         this._aircraftTitle || 'MSFS Aircraft',
                  eng1, eng2,
                  beaconLight:      beacon,
                  strobeLight:      strobe,
                  navLight:         nav,
                  taxiLight:        taxi,
                  flapsIndex:       flapsIdx,
                  gearDown,
                  altAgl,
                  gForce,
                  simRate,
                  totalWeightKg:    totalKg,
                  fuelWeightKg:     fuelKg,
                  spoilersPos:      spoilers,
                  stallWarning:     stallWarn,
                  overspeedWarning: ovspWarn,
                  bankDeg,
                  windDir,
                  windSpd,
                  parkingBrake,
                });
              } catch (_) {}
            }

            if (packet.requestID === 2) {
              try {
                const title = packet.data.readString256();
                if (title && title !== 'MSFS Aircraft') {
                  this._aircraftTitle = title;
                  clearInterval(titleInterval);
                }
              } catch (_) {}
            }
          });

          // Título da aeronave
          conn.addToDataDefinition(2, 'TITLE', null, SimConnectDataType.STRING256);
          const requestTitle = () => {
            try { conn.requestDataOnSimObject(2, 2, 0, SimConnectPeriod.ONCE, 0, 0, 0, 0); } catch (_) {}
          };
          requestTitle();
          const titleInterval = setInterval(() => {
            if (this._aircraftTitle) { clearInterval(titleInterval); return; }
            requestTitle();
          }, 3000);

        }, 2000);

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
