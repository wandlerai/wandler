export default {
	preset: "ts-jest",
	testEnvironment: "jsdom",
	transform: { "^.+\\.ts$": "ts-jest" },
	extensionsToTreatAsEsm: [".ts"],
	moduleNameMapper: {
		"^(\\.{1,2}/.*)\\.js$": "$1",
	},
};
