import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    webpack: (config) => {
        config.ignoreWarnings = [
            { message: /Serializing big strings/ },
        ];
        return config;
    },
};

export default nextConfig;
