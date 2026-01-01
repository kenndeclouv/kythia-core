import { describe, it, expect } from 'vitest';
import { convertColor } from '../src/utils/color';

describe('utils/color', () => {
	describe('convertColor', () => {
		it('should correctly convert Hex to Decimal', () => {
			// Red: #ED4245 -> 15548997
			const result = convertColor('#ED4245', { from: 'hex', to: 'decimal' });
			expect(result).toBe(15548997);
		});

		it('should correctly convert RGB to Hex', () => {
			// Green: rgb(87, 242, 135) -> #57F287
			const result = convertColor(
				{ r: 87, g: 242, b: 135 },
				{ from: 'rgb', to: 'hex' },
			);
			expect(result).toBe('#57F287');
		});

		it('should correctly convert Discord Color Name to Hex', () => {
			// Blurple: 0x5865F2 -> #5865F2
			const result = convertColor('Blurple', { from: 'discord', to: 'hex' });
			expect(result).toBe('#5865F2');
		});

		it('should throw error for invalid hex', () => {
			expect(() =>
				convertColor('#ZZZZZZ', { from: 'hex', to: 'decimal' }),
			).toThrow('Invalid hex color');
		});
	});
});
