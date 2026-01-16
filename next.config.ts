import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    transpilePackages: [
        '@pioneer-platform/pioneer-sdk',
        '@coinmasters/types',
        '@coinmasters/tokens'
    ],
    serverExternalPackages: ['swagger-client', '@swagger-api/apidom-reference'],
    webpack: (config, { isServer }) => {
        // Suppress CommonJS/ESM interop warnings
        const ignoreWarnings = [
            { message: /Serializing big strings/ },
            (warning: any) => {
                if (warning.message?.includes('node:buffer')) return true;
                if (warning.message?.includes('unexpected export')) return true;
                if (warning.message?.includes('export * used with module')) return true;
                return false;
            },
        ];
        config.ignoreWarnings = ignoreWarnings;

        config.resolve.extensionAlias = {
            '.js': ['.js', '.ts', '.tsx'],
            '.mjs': ['.mjs', '.mts'],
            '.cjs': ['.cjs', '.cts'],
        };

        return config;
    },
};

export default nextConfig;
