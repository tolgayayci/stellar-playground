#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Symbol};

const COUNTER_KEY: Symbol = Symbol::short("COUNTER");

#[contract]
pub struct Counter;

// This is a sample counter contract that demonstrates persistent storage.
// It shows how to store and retrieve data on the Stellar blockchain.
//
// For comprehensive examples, visit <https://github.com/stellar/soroban-examples>.
// Refer to the official documentation:
// <https://developers.stellar.org/docs/build/smart-contracts/overview>.
#[contractimpl]
impl Counter {
    /// Get the current count
    pub fn get_count(env: Env) -> u32 {
        // Get the counter from storage, or return 0 if not found
        env.storage().persistent().get(&COUNTER_KEY).unwrap_or(0)
    }

    /// Increment the counter and return the new value
    pub fn increment(env: Env) -> u32 {
        // Get current count
        let mut count: u32 = env.storage().persistent().get(&COUNTER_KEY).unwrap_or(0);

        // Increment
        count += 1;

        // Store the new value
        env.storage().persistent().set(&COUNTER_KEY, &count);

        // Extend the TTL (time to live) for this storage entry
        // This ensures the data persists for at least 100 ledgers
        env.storage()
            .persistent()
            .extend_ttl(&COUNTER_KEY, 100, 100);

        // Return the new count
        count
    }

    /// Reset the counter to zero
    pub fn reset(env: Env) {
        env.storage().persistent().set(&COUNTER_KEY, &0u32);

        env.storage()
            .persistent()
            .extend_ttl(&COUNTER_KEY, 100, 100);
    }

    /// Set the counter to a specific value
    pub fn set_count(env: Env, value: u32) {
        env.storage().persistent().set(&COUNTER_KEY, &value);

        env.storage()
            .persistent()
            .extend_ttl(&COUNTER_KEY, 100, 100);
    }
}

mod test;
