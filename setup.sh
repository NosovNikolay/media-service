#!/bin/bash

# Exit script if any command fails
set -e

echo "Setting up media-service..."

# Check if running in a Docker container
if [ -f /.dockerenv ]; then
  echo "Running in Docker container environment"
  IS_DOCKER=true
else
  IS_DOCKER=false
fi

# Function to install Volta if not already installed
install_volta() {
  echo "Installing Volta..."
  # CURL is required for Volta installation
  if ! command -v curl &> /dev/null; then
    echo "curl is required but not installed. Please install curl first."
    exit 1
  fi

  # Install Volta
  curl https://get.volta.sh | bash

  # Update current shell to use Volta
  export VOLTA_HOME="$HOME/.volta"
  export PATH="$VOLTA_HOME/bin:$PATH"

  echo "Volta installed successfully!"
}

# Setup for local development environment
setup_local() {
  # Check if Volta is installed
  if ! command -v volta &> /dev/null; then
    install_volta
  else
    echo "Volta is already installed"
  fi

  # Make sure we have the right Node.js version
  echo "Setting up Node.js environment using Volta..."
  volta install node@22.14.0
  volta install npm@10.9.2

  # Install dependencies
  echo "Installing dependencies..."
  npm install

  # Build the project
  echo "Building the project..."
  npm run build

  echo "Setup completed successfully!"
  echo "You can now run the project with:"
  echo "npm start   # For production"
  echo "npm run dev # For development with hot-reloading"
}

# Setup for Docker environment
setup_docker() {
  echo "Setting up Docker environment..."
  
  # Check if Docker is installed
  if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
  fi

  # Build Docker image
  echo "Building Docker image..."
  docker build -t media-service .

  echo "Docker setup completed successfully!"
  echo "You can run the service with:"
  echo "docker run -p 3000:3000 --env-file .env media-service"
}

# Main execution
if [ "$IS_DOCKER" = true ]; then
  # Inside Docker, install Node directly (Volta not needed)
  echo "Installing dependencies..."
  npm install

  echo "Building the project..."
  npm run build
else
  # Outside Docker, determine what to set up
  if [ "$1" = "--docker" ]; then
    setup_docker
  else
    setup_local
  fi
fi

echo ""
echo "Media Service setup complete!" 