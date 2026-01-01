/**
 * 🚜 Database Seeder Base Class
 *
 * @file src/database/Seeder.ts
 * @copyright © 2025 kenndeclouv
 * @assistant graa & chaa
 * @version 0.12.9-beta
 *
 * @description
 * Abstract base class that all Seeders must extend.
 * Provides the structure for seeding the database with test/initial data.
 */

import type { KythiaContainer } from '../types';

export abstract class Seeder {
	/**
	 * The application container for accessing dependencies.
	 */
	protected container: KythiaContainer;

	/**
	 * Creates a new Seeder instance.
	 * @param container The dependency container.
	 */
	constructor(container: KythiaContainer) {
		this.container = container;
	}

	/**
	 * Run the database seeds.
	 * This method must be implemented by the user's seeder class.
	 */
	public abstract run(): Promise<void>;

	/**
	 * Call another seeder class.
	 * @param SeederClass The seeder class to call.
	 */
	public async call(
		SeederClass: new (container: KythiaContainer) => Seeder,
	): Promise<void> {
		const seeder = new SeederClass(this.container);
		await seeder.run();
	}
}
