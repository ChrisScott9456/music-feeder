FROM node:18-alpine

# Install Python 3 and build-essential tools
RUN apk add --no-cache python3 py3-pip build-base ffmpeg

# Set the working directory in the container
WORKDIR /

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code to the container
COPY . .

# Compile TypeScript
RUN npm run build

# Run application
CMD ["node", "build/index.js"]