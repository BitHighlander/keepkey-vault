import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    transpilePackages: [
        '@coinmasters/pioneer-sdk',
        '@coinmasters/types',
        '@coinmasters/tokens'
    ],
    webpack: (config) => {
        config.ignoreWarnings = [
            { message: /Serializing big strings/ },
        ];
        config.resolve.extensionAlias = {
            '.js': ['.js', '.ts', '.tsx'],
            '.mjs': ['.mjs', '.mts'],
            '.cjs': ['.cjs', '.cts'],
        };
        return config;
    },
};

export default nextConfig;
