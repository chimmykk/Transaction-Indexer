#!/bin/bash

# API endpoint
API_URL="http://localhost:6000/api/fetchcollectiondetails"

# Loop to make requests every 10 seconds
while true; do
    # Making a GET request to the API
    response=$(curl -s -w "%{http_code}" -o response.json "$API_URL")

    # Checking the HTTP response code
    if [ "$response" -eq 200 ]; then
        echo "Request successful!"
    
    elif [ "$response" -eq 404 ]; then
        echo "Error: Resource not found (404)"
    else
        echo "Error: Received HTTP status code $response"
    fi

    # Wait for 10 min
    sleep 600
done
