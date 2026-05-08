const dgram = require('dgram');

const XPLANE_IP   = '127.0.0.1';
const XPLANE_PORT = 49000;
const LOCAL_PORT  = 49001;

const DATAREFS = [
  // Posição
  { id: 1,  ref: 'sim/flightmodel/position/latitude' },
  { id: 2,  ref: 'sim/flightmodel/position/longitude' },
  { id: 3,  ref: 'sim/flightmodel/position/elevation' },                           // m
  { id: 4,  ref: 'sim/flightmodel/position/indicated_airspeed' },                  // m/s
  { id: 5,  ref: 'sim/flightmodel/position/vh_ind_fpm' },                          // fpm
  { id: 6,  ref: 'sim/flightmodel/position/psi' },                                 // heading
  { id: 7,  ref: 'sim/flightmodel/position/y_agl' },                               // AGL metros
  { id: 8,  ref: 'sim/flightmodel/position/phi' },                                 // bank angle graus
  // Solo
  { id: 9,  ref: 'sim/flightmodel/misc/in_the_air' },                             // 0=solo
  // Combustível
  { id: 10, ref: 'sim/cockpit2/fuel/fuel_quantity_total_shown_pilot' },            // litros
  { id: 11, ref: 'sim/flightmodel/weight/m_fuel_total' },                          // kg
  // Peso total
  { id: 12, ref: 'sim/flightmodel/weight/m_total' },                               // kg
  // Motores (queimando combustível = ligado)
  { id: 13, ref: 'sim/cockpit2/engine/indicators/engine_is_burning_fuel[0]' },
  { id: 14, ref: 'sim/cockpit2/engine/indicators/engine_is_burning_fuel[1]' },
  // Luzes
  { id: 15, ref: 'sim/cockpit/electrical/beacon_lights_on' },
  { id: 16, ref: 'sim/cockpit/electrical/landing_lights_on' },
  { id: 17, ref: 'sim/cockpit/electrical/taxi_light_on' },
  { id: 18, ref: 'sim/cockpit/electrical/nav_lights_on' },
  { id: 19, ref: 'sim/cockpit/electrical/strobe_lights_on' },
  // Controles
  { id: 20, ref: 'sim/cockpit2/controls/flap_ratio' },                             // 0-1
  { id: 21, ref: 'sim/aircraft/parts/acf_gear_deploy[0]' },                        // gear
  { id: 22, ref: 'sim/cockpit2/controls/parking_brake_ratio' },
  { id: 23, ref: 'sim/cockpit2/controls/speedbrake_ratio' },                        // spoilers 0-1
  // Avisos
  { id: 24, ref: 'sim/cockpit2/annunciators/stall_warning' },
  { id: 25, ref: 'sim/cockpit2/annunciators/overspeed' },
  // Física
  { id: 26, ref: 'sim/flightmodel/forces/gnormal' },                               // G-force
  // Sim rate
  { id: 27, ref: 'sim/time/sim_speed' },
  // Transponder
  { id: 28, ref: 'sim/cockpit/radios/transponder_mode' },                          // 3=Modo C
  // Vento (camada 0)
  { id: 29, ref: 'sim/weather/wind_direction_degt[0]' },
  { id: 30, ref: 'sim/weather/wind_speed_kt[0]' },
];

class XPlaneHandler {
  constructor() {
    this.socket     = null;
    this.onData     = null;
    this.onStatus   = null;
    this._state     = {};
    this._interval  = null;
    this._connected = false;
    this._wasInAir  = true;   // para capturar VS pré-pouso
    this._prevVS    = 0;
    this._touchdownVS = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = dgram.createSocket('udp4');

      this.socket.on('error', (err) => {
        this.onStatus && this.onStatus({ connected: false, type: 'xplane' });
        reject(err);
      });

      this.socket.bind(LOCAL_PORT, () => {
        this._subscribeAll();

        const timeout = setTimeout(() => {
          this.onStatus && this.onStatus({ connected: true, type: 'xplane' });
          resolve();
        }, 5000);

        this.socket.on('message', (msg) => {
          clearTimeout(timeout);
          this._parseRREF(msg);
          if (!this._connected) {
            this._connected = true;
            this.onStatus && this.onStatus({ connected: true, type: 'xplane' });
            resolve();
          }
        });
      });

      this._interval = setInterval(() => {
        if (this.onData && Object.keys(this._state).length > 0) {
          this.onData(this._buildPacket());
        }
      }, 1000);
    });
  }

  _buildPacket() {
    const s = this._state;

    // Flap ratio → índice discreto (0-4)
    const flapRatio = s[20] || 0;
    let flapsIndex;
    if      (flapRatio < 0.05) flapsIndex = 0;
    else if (flapRatio < 0.25) flapsIndex = 1;
    else if (flapRatio < 0.50) flapsIndex = 2;
    else if (flapRatio < 0.75) flapsIndex = 3;
    else                       flapsIndex = 4;

    const inAir  = (s[9] || 0) !== 0;
    const curVS  = s[5] || 0;

    // Captura VS imediatamente antes do toque — mais preciso que o VS pós-pouso
    if (!inAir && this._wasInAir) {
      this._touchdownVS = Math.abs(Math.min(this._prevVS, 0));
    } else if (inAir) {
      this._prevVS      = curVS;
      this._touchdownVS = null;
    }
    this._wasInAir = inAir;

    return {
      lat:              s[1]  || 0,
      lon:              s[2]  || 0,
      alt:              (s[3]  || 0) * 3.28084,         // m → ft
      spd:              (s[4]  || 0) * 1.94384,         // m/s → kts
      vs:               curVS,
      hdg:              s[6]  || 0,
      altAgl:           (s[7]  || 0) * 3.28084,         // m → ft
      bankDeg:          s[8]  || 0,
      onGround:         !inAir,
      fuel:             (s[10] || 0) * 0.264172,        // L → gal
      fuelWeightKg:     s[11] || 0,
      totalWeightKg:    s[12] || 0,
      eng1:             (s[13] || 0) > 0,
      eng2:             (s[14] || 0) > 0,
      beaconLight:      (s[15] || 0) > 0,
      landingLights:    (s[16] || 0) > 0,
      taxiLight:        (s[17] || 0) > 0,
      navLight:         (s[18] || 0) > 0,
      strobeLight:      (s[19] || 0) > 0,
      flapsIndex,
      gearDown:         (s[21] || 0) >= 0.5,
      parkingBrake:     (s[22] || 0) > 0.5,
      spoilersPos:      (s[23] || 0) * 4500,            // normaliza para compat. com MSFS
      stallWarning:     (s[24] || 0) > 0,
      overspeedWarning: (s[25] || 0) > 0,
      gForce:           s[26] || 1.0,
      simRate:          s[27] || 1.0,
      transponderMode:  s[28] || 0,
      windDir:          s[29] || 0,
      windSpd:          s[30] || 0,
      touchdownVS:      this._touchdownVS,
      aircraft:         'X-Plane Aircraft',
    };
  }

  _subscribeAll() {
    DATAREFS.forEach(({ id, ref }) => {
      const buf = Buffer.alloc(413);
      buf.write('RREF\0', 0, 'ascii');
      buf.writeFloatLE(1, 5);
      buf.writeInt32LE(id, 9);
      buf.write(ref + '\0', 13, 'ascii');
      this.socket.send(buf, 0, buf.length, XPLANE_PORT, XPLANE_IP);
    });
  }

  _parseRREF(msg) {
    if (msg.length < 5) return;
    if (msg.slice(0, 4).toString('ascii') !== 'RREF') return;
    for (let i = 5; i + 8 <= msg.length; i += 8) {
      const idx = msg.readInt32LE(i);
      const val = msg.readFloatLE(i + 4);
      this._state[idx] = val;
    }
  }

  disconnect() {
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
    if (this.socket) {
      DATAREFS.forEach(({ id, ref }) => {
        const buf = Buffer.alloc(413);
        buf.write('RREF\0', 0, 'ascii');
        buf.writeFloatLE(0, 5);
        buf.writeInt32LE(id, 9);
        buf.write(ref + '\0', 13, 'ascii');
        try { this.socket.send(buf, 0, buf.length, XPLANE_PORT, XPLANE_IP); } catch (_) {}
      });
      try { this.socket.close(); } catch (_) {}
      this.socket = null;
    }
  }
}

module.exports = XPlaneHandler;
