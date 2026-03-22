const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'assets.rumahotp.com' },
      { protocol: 'https', hostname: 'cdn.rumahotp.com' },
      { protocol: 'https', hostname: 'www.imei.info' },
    ],
  },
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname);
    return config;
  },
};

module.exports = nextConfig;
