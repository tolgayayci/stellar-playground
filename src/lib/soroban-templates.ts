// Soroban Contract Templates

export const HELLO_WORLD_CODE = `#![no_std]
use soroban_sdk::{contract, contractimpl, vec, Env, String, Vec};

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    pub fn hello(env: Env, to: String) -> Vec<String> {
        vec![&env, String::from_str(&env, "Hello"), to]
    }
}`;

export const COUNTER_CODE = `#![no_std]
use soroban_sdk::{contract, contractimpl, log, symbol_short, Env, Symbol};

const COUNTER: Symbol = symbol_short!("COUNTER");

#[contract]
pub struct IncrementContract;

#[contractimpl]
impl IncrementContract {
    /// Increment the counter and return the new value
    pub fn increment(env: Env) -> u32 {
        let mut count: u32 = env.storage().instance().get(&COUNTER).unwrap_or(0);

        log!(&env, "count: {}", count);

        count += 1;

        env.storage().instance().set(&COUNTER, &count);
        env.storage().instance().extend_ttl(50, 100);

        count
    }

    /// Get the current counter value
    pub fn get_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&COUNTER)
            .unwrap_or(0)
    }

    /// Reset the counter to zero
    pub fn reset(env: Env) {
        env.storage().instance().set(&COUNTER, &0);
        env.storage().instance().extend_ttl(50, 100);
    }
}`;

export const EVENTS_CODE = `#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, Env, Symbol};

const COUNTER: Symbol = symbol_short!("COUNTER");

#[contract]
pub struct IncrementContract;

#[contractimpl]
impl IncrementContract {
    pub fn increment(env: Env) -> u32 {
        let mut count: u32 = env.storage().instance().get(&COUNTER).unwrap_or(0);

        count += 1;

        env.storage().instance().set(&COUNTER, &count);

        // Publish event with topics and data
        env.events().publish((symbol_short!("COUNTER"), symbol_short!("increment")), count);

        count
    }

    pub fn get_count(env: Env) -> u32 {
        env.storage().instance().get(&COUNTER).unwrap_or(0)
    }
}`;

export const ATOMIC_SWAP_CODE = `#![no_std]
use soroban_sdk::{contract, contractimpl, token, Address, Env, IntoVal};

#[contract]
pub struct AtomicSwapContract;

#[contractimpl]
impl AtomicSwapContract {
    pub fn swap(
        env: Env,
        a: Address,
        b: Address,
        token_a: Address,
        token_b: Address,
        amount_a: i128,
        min_b_for_a: i128,
        amount_b: i128,
        min_a_for_b: i128,
    ) {
        // Verify preconditions on the minimum price for both parties
        if amount_b < min_b_for_a {
            panic!("not enough token B for token A");
        }
        if amount_a < min_a_for_b {
            panic!("not enough token A for token B");
        }

        // Require authorization for a subset of arguments specific to a party
        a.require_auth_for_args(
            (token_a.clone(), token_b.clone(), amount_a, min_b_for_a).into_val(&env)
        );
        b.require_auth_for_args(
            (token_b.clone(), token_a.clone(), amount_b, min_a_for_b).into_val(&env)
        );

        // Perform the swap by moving tokens from a to b and from b to a
        move_token(&env, &token_a, &a, &b, amount_a, min_a_for_b);
        move_token(&env, &token_b, &b, &a, amount_b, min_b_for_a);
    }
}

fn move_token(
    env: &Env,
    token: &Address,
    from: &Address,
    to: &Address,
    max_spend_amount: i128,
    transfer_amount: i128,
) {
    let token = token::Client::new(env, token);
    let contract_address = env.current_contract_address();
    // Receiving account (to) must increase their allowance to the contract
    token.transfer(from, to, &transfer_amount);
    // Max amount the contract can spend is reduced by the amount just transferred
    if max_spend_amount > transfer_amount {
        token.approve(from, &contract_address, &(max_spend_amount - transfer_amount), &(env.ledger().sequence() + 100));
    }
}`;

export const SIMPLE_TOKEN_CODE = `#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, String};

#[contracttype]
#[derive(Clone)]
pub struct TokenMetadata {
    pub name: String,
    pub symbol: String,
    pub decimals: u32,
}

#[contract]
pub struct Token;

#[contractimpl]
impl Token {
    pub fn initialize(env: Env, admin: Address, name: String, symbol: String) {
        if env.storage().instance().has(&symbol_short!("ADMIN")) {
            panic!("already initialized");
        }

        env.storage().instance().set(&symbol_short!("ADMIN"), &admin);

        let metadata = TokenMetadata {
            name,
            symbol,
            decimals: 7,
        };

        env.storage().instance().set(&symbol_short!("METADATA"), &metadata);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&symbol_short!("ADMIN")).unwrap();
        admin.require_auth();

        let balance = Self::balance(env.clone(), to.clone());
        env.storage().instance().set(&to, &(balance + amount));
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage().instance().get(&id).unwrap_or(0)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();

        let from_balance = Self::balance(env.clone(), from.clone());
        let to_balance = Self::balance(env.clone(), to.clone());

        if from_balance < amount {
            panic!("insufficient balance");
        }

        env.storage().instance().set(&from, &(from_balance - amount));
        env.storage().instance().set(&to, &(to_balance + amount));
    }
}`;

export const TIMELOCK_CODE = `#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Vec};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Init,
    Balance,
}

#[derive(Clone)]
#[contracttype]
pub enum TimeBoundKind {
    Before,
    After,
}

#[derive(Clone)]
#[contracttype]
pub struct TimeBound {
    pub kind: TimeBoundKind,
    pub timestamp: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct ClaimableBalance {
    pub token: Address,
    pub amount: i128,
    pub claimants: Vec<Address>,
    pub time_bound: TimeBound,
}

#[contract]
pub struct ClaimableBalanceContract;

fn check_time_bound(env: &Env, time_bound: &TimeBound) -> bool {
    let ledger_timestamp = env.ledger().timestamp();

    match time_bound.kind {
        TimeBoundKind::Before => ledger_timestamp <= time_bound.timestamp,
        TimeBoundKind::After => ledger_timestamp >= time_bound.timestamp,
    }
}

fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Init)
}

#[contractimpl]
impl ClaimableBalanceContract {
    pub fn deposit(
        env: Env,
        from: Address,
        token: Address,
        amount: i128,
        claimants: Vec<Address>,
        time_bound: TimeBound,
    ) {
        if claimants.len() > 10 {
            panic!("too many claimants");
        }
        if is_initialized(&env) {
            panic!("contract has been already initialized");
        }

        from.require_auth();

        token::Client::new(&env, &token).transfer(&from, &env.current_contract_address(), &amount);

        env.storage().instance().set(
            &DataKey::Balance,
            &ClaimableBalance {
                token,
                amount,
                claimants,
                time_bound,
            },
        );

        env.storage().instance().set(&DataKey::Init, &());
    }

    pub fn claim(env: Env, claimant: Address) {
        claimant.require_auth();

        let claimable_balance: ClaimableBalance = env.storage().instance().get(&DataKey::Balance).unwrap();

        if !claimable_balance.claimants.contains(&claimant) {
            panic!("claimant is not allowed to claim this balance");
        }

        if !check_time_bound(&env, &claimable_balance.time_bound) {
            panic!("time predicate is not fulfilled");
        }

        token::Client::new(&env, &claimable_balance.token).transfer(
            &env.current_contract_address(),
            &claimant,
            &claimable_balance.amount,
        );

        env.storage().instance().remove(&DataKey::Balance);
        env.storage().instance().remove(&DataKey::Init);
    }
}`;
