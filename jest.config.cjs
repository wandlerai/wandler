module.exports = {
	preset: "ts-jest",
	testEnvironment: "jsdom",
	transform: {
		"^.+\\.ts$": [
			"ts-jest",
			{
				useESM: true,
				tsconfig: {
					moduleResolution: "node",
				},
			},
		],
	},
	extensionsToTreatAsEsm: [".ts"],
	moduleNameMapper: {
		"^(\\.{1,2}/.*)\\.js$": "$1",
		"^@wandler$": "<rootDir>/packages/wandler/index.ts",
		"^@wandler/(.*)$": "<rootDir>/packages/wandler/$1",
	},
	roots: ["<rootDir>"],
	setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
	testMatch: ["<rootDir>/tests/**/*.test.ts", "<rootDir>/packages/*/tests/**/*.test.ts"],
	moduleDirectories: ["node_modules", "<rootDir>"],
};
