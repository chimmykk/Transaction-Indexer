#!/bin/bash

# Number of requests to send
num_requests=50

# Create a function to send the request
send_request() {
  response=$(curl -s -w "%{http_code}" -o /dev/null "https://blockscoutapi.hekla.taiko.xyz/api?module=account&action=tokenbalance&contractaddress=0x4d7F60482D028e8C4baBf0ABE09D781F55BDd172&address=0xeca86f60212d55c64e82e906881ed375d237f025")
  echo $response
}

export -f send_request

# Send requests in parallel
seq $num_requests | xargs -n1 -P1000 bash -c 'send_request'
