/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: false,
  images: {
    loader: "cloudinary",
    path: `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
    // domains: ['res.cloudinary.com']
  },
  compiler: {
    styledComponents: true,
  },
};

module.exports = nextConfig;
