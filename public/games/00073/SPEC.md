# Room 00073 — Prime Number Generator

## What it is
A utility that computes and displays the Nth prime number for any N from 1 to 10,000.

## How it works
- Sieve of Eratosthenes precomputed on page load (limit 105,000 — covers first 10,000 primes)
- User enters N, presses Generate or Enter
- Displays the Nth prime with formatting
- N=1 gets a note about 2 being the only even prime
- N=1000 gets a note about π(7919)=1000
- N=1401 gets a special note referencing Room 00052 (The Illegal Prime)

## Navigation
- data-nav: matrix
- Connects to: 00072 (left), 00074 (right)

## Notes
- 10,000th prime is 104,729 — fits comfortably in the sieve limit
- The 1401st prime is 11,593 (Nth prime cross-reference with the illegal prime room)
