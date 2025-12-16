/**
 * 🎨 Color Converter Utility
 * @file src/utils/color.ts
 */

const discordColors: Record<string, number> = {
	Default: 0x000000,
	White: 0xffffff,
	Aqua: 0x1abc9c,
	Green: 0x57f287,
	Blue: 0x3498db,
	Yellow: 0xfee75c,
	Purple: 0x9b59b6,
	LuminousVividPink: 0xe91e63,
	Fuchsia: 0xeb459e,
	Gold: 0xf1c40f,
	Orange: 0xe67e22,
	Red: 0xed4245,
	Grey: 0x95a5a6,
	Navy: 0x34495e,
	DarkAqua: 0x11806a,
	DarkGreen: 0x1f8b4c,
	DarkBlue: 0x206694,
	DarkPurple: 0x71368a,
	DarkVividPink: 0xad1457,
	DarkGold: 0xc27c0e,
	DarkOrange: 0xa84300,
	DarkRed: 0x992d22,
	DarkGrey: 0x979c9f,
	DarkerGrey: 0x7f8c8d,
	LightGrey: 0xbcc0c0,
	DarkNavy: 0x2c3e50,
	Blurple: 0x5865f2,
	Greyple: 0x99aab5,
	DarkButNotBlack: 0x2c2f33,
	NotQuiteBlack: 0x23272a,
};

export interface RGB {
	r: number;
	g: number;
	b: number;
}

export type ColorInput = string | number | RGB;
export type ColorFormat = 'hex' | 'rgb' | 'decimal';
export type SourceFormat = ColorFormat | 'discord';

export interface ConvertOptions {
	from: SourceFormat;
	to: ColorFormat;
}

/**
 * Converts a color between multiple representations.
 */
export function convertColor(
	input: ColorInput,
	options: { from: SourceFormat; to: 'hex' },
): string;
export function convertColor(
	input: ColorInput,
	options: { from: SourceFormat; to: 'rgb' },
): RGB;
export function convertColor(
	input: ColorInput,
	options: { from: SourceFormat; to: 'decimal' },
): number;
export function convertColor(
	input: ColorInput,
	options: ConvertOptions,
): string | number | RGB;

export function convertColor(
	input: ColorInput,
	{ from, to }: ConvertOptions,
): string | number | RGB {
	function hexToRgb(hex: string): RGB {
		let h = hex.replace(/^#/, '');
		if (h.length === 3) {
			h = h
				.split('')
				.map((x) => x + x)
				.join('');
		}
		if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error('Invalid hex color');
		return {
			r: parseInt(h.slice(0, 2), 16),
			g: parseInt(h.slice(2, 4), 16),
			b: parseInt(h.slice(4, 6), 16),
		};
	}

	function rgbToHex({ r, g, b }: RGB): string {
		if (
			typeof r !== 'number' ||
			typeof g !== 'number' ||
			typeof b !== 'number' ||
			r < 0 ||
			r > 255 ||
			g < 0 ||
			g > 255 ||
			b < 0 ||
			b > 255
		)
			throw new Error('Invalid RGB color');
		return (
			'#' +
			[r, g, b]
				.map((x) => {
					const hex = x.toString(16);
					return hex.length === 1 ? `0${hex}` : hex;
				})
				.join('')
				.toUpperCase()
		);
	}

	function hexToDecimal(hex: string): number {
		let h = hex.replace(/^#/, '');
		if (h.length === 3) {
			h = h
				.split('')
				.map((x) => x + x)
				.join('');
		}
		if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error('Invalid hex color');
		return Number(`0x${h.toUpperCase()}`);
	}

	function decimalToHex(decimal: number): string {
		if (typeof decimal !== 'number' || decimal < 0 || decimal > 0xffffff)
			throw new Error('Invalid decimal color');
		let hex = decimal.toString(16).toUpperCase();
		while (hex.length < 6) hex = `0${hex}`;
		return `#${hex}`;
	}

	function rgbToDecimal({ r, g, b }: RGB): number {
		return (r << 16) + (g << 8) + b;
	}

	function decimalToRgb(decimal: number): RGB {
		if (typeof decimal !== 'number' || decimal < 0 || decimal > 0xffffff)
			throw new Error('Invalid decimal color');
		return {
			r: (decimal >> 16) & 0xff,
			g: (decimal >> 8) & 0xff,
			b: decimal & 0xff,
		};
	}

	if (from === to) return input as any;

	let rgb: RGB | undefined;
	let hex: string | undefined;
	let decimal: number | undefined;

	switch (from) {
		case 'hex':
			hex = input as string;
			rgb = hexToRgb(hex);
			decimal = hexToDecimal(hex);
			break;
		case 'rgb':
			rgb = input as RGB;
			hex = rgbToHex(rgb);
			decimal = rgbToDecimal(rgb);
			break;
		case 'decimal':
			decimal = input as number;
			hex = decimalToHex(decimal);
			rgb = decimalToRgb(decimal);
			break;
		case 'discord':
			if (typeof input === 'string') {
				const key = Object.keys(discordColors).find(
					(k) => k.toLowerCase() === input.toLowerCase(),
				);
				if (!key) throw new Error(`Invalid Discord color name: ${input}`);
				decimal = discordColors[key];
			} else if (typeof input === 'number') {
				decimal = input;
			} else {
				throw new Error('Invalid input type for Discord color');
			}
			hex = decimalToHex(decimal);
			rgb = decimalToRgb(decimal);
			break;
		default:
			throw new Error(`Invalid "from" color type: ${from}`);
	}

	switch (to) {
		case 'hex':
			return hex;
		case 'rgb':
			return rgb;
		case 'decimal':
			return decimal;
		default:
			throw new Error(`Invalid "to" color type: ${to}`);
	}
}
