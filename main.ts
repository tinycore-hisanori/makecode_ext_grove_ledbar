/**
 * Grove LED Bar (MY9221) driver for micro:bit MakeCode
 *
 * Protocol is implemented by bit-banging DATA/CLOCK like Seeed Arduino library.
 */

//% color=#00BFA5 icon="\uf012" block="Grove LED Bar"
namespace groveLedBar {
    let _inited = false
    let _clk: DigitalPin
    let _dat: DigitalPin
    let _reverse = false

    // MY9221 wants 12x16bit words for LED bar (10 used + padding).
    // Each LED word is 8-bit PWM-ish pattern (0x00..0xFF) sent as 16-bit value in the Arduino lib.
    let _led: number[] = [0,0,0,0,0,0,0,0,0,0] // 10 segments

    function clamp(v: number, lo: number, hi: number) {
        if (v < lo) return lo
        if (v > hi) return hi
        return v
    }

    function send16(word: number) {
        // Arduino reference shifts out MSB first across 16 cycles. :contentReference[oaicite:2]{index=2}
        word &= 0xFFFF
        for (let i = 0; i < 16; i++) {
            const bit = (word & 0x8000) !== 0
            pins.digitalWritePin(_dat, bit ? 1 : 0)

            // Use a clean pulse (low->high) per bit.
            pins.digitalWritePin(_clk, 0)
            pins.digitalWritePin(_clk, 1)

            word = (word << 1) & 0xFFFF
        }
    }

    function latch() {
        // Mirrors the latch sequence in the Seeed Arduino lib. :contentReference[oaicite:3]{index=3}
        pins.digitalWritePin(_dat, 0)

        // clock pulses
        pins.digitalWritePin(_clk, 1)
        pins.digitalWritePin(_clk, 0)
        pins.digitalWritePin(_clk, 1)
        pins.digitalWritePin(_clk, 0)

        control.waitMicros(240)

        // data toggles (4 times)
        for (let i = 0; i < 4; i++) {
            pins.digitalWritePin(_dat, 1)
            pins.digitalWritePin(_dat, 0)
        }

        control.waitMicros(1)

        pins.digitalWritePin(_clk, 1)
        pins.digitalWritePin(_clk, 0)
    }

    function flush() {
        if (!_inited) return

        // cmd word first (0x0000) :contentReference[oaicite:4]{index=4}
        send16(0x0000)

        // send 10 LED words + padding to 12
        if (_reverse) {
            for (let i = 9; i >= 0; i--) send16(_led[i] & 0xFF)
        } else {
            for (let i = 0; i < 10; i++) send16(_led[i] & 0xFF)
        }
        send16(0x0000)
        send16(0x0000)

        latch()
    }

    /**
     * Initialize Grove LED Bar.
     * @param clockPin CLOCK pin
     * @param dataPin DATA pin
     * @param greenToRed true = green->red direction (reverse)
     */
    //% block="init Grove LED Bar clock %clockPin data %dataPin greenToRed %greenToRed"
    //% clockPin.fieldEditor="gridpicker" clockPin.fieldOptions.columns=4
    //% dataPin.fieldEditor="gridpicker" dataPin.fieldOptions.columns=4
    export function init(clockPin: DigitalPin, dataPin: DigitalPin, greenToRed: boolean = false) {
        _clk = clockPin
        _dat = dataPin
        _reverse = greenToRed
        _inited = true

        pins.digitalWritePin(_clk, 0)
        pins.digitalWritePin(_dat, 0)

        for (let i = 0; i < 10; i++) _led[i] = 0
        flush()
    }

    /**
     * Set display direction.
     */
    //% block="set direction greenToRed %greenToRed"
    export function setGreenToRed(greenToRed: boolean) {
        _reverse = greenToRed
        flush()
    }

    /**
     * Set bar level (0..10). Allows fractional values (e.g., 3.5).
     */
    //% block="set level %level"
    export function setLevel(level: number) {
        if (!_inited) return
        level = clamp(level, 0, 10)

        // Arduino lib uses 8 noticeable brightness steps per segment. :contentReference[oaicite:5]{index=5}
        let x = level * 8.0

        for (let i = 0; i < 10; i++) {
            let v = 0
            if (x >= 8) v = 0xFF
            else if (x > 0) {
                // e.g. x=1..7 => 0b00000001..0b01111111
                const n = clamp(Math.floor(x), 0, 8)
                v = (1 << n) - 1
            } else v = 0

            _led[i] = v & 0xFF
            x -= 8.0
        }
        flush()
    }

    /**
     * Set one LED (1..10) brightness 0..1.
     */
    //% block="set LED %index brightness %brightness"
    export function setLed(index: number, brightness: number) {
        if (!_inited) return
        index = clamp(index, 1, 10)
        brightness = clamp(brightness, 0, 1)

        const steps = clamp(Math.floor(brightness * 8), 0, 8)
        const v = steps === 0 ? 0 : (1 << steps) - 1
        _led[index - 1] = v & 0xFF

        flush()
    }

    /**
     * Set LEDs by 10-bit mask (bit0 = LED1).
     */
    //% block="set bits %mask"
    export function setBits(mask: number) {
        if (!_inited) return
        mask = mask | 0
        for (let i = 0; i < 10; i++) {
            _led[i] = (mask & (1 << i)) ? 0xFF : 0x00
        }
        flush()
    }

    /**
     * Clear all LEDs.
     */
    //% block="clear"
    export function clear() {
        if (!_inited) return
        for (let i = 0; i < 10; i++) _led[i] = 0
        flush()
    }
}
