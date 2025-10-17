import {
  Code2,
  MessageCircle,
  Coins,
  Clock,
  ArrowLeftRight
} from 'lucide-react';
import {
  HELLO_WORLD_CODE,
  COUNTER_CODE,
  SIMPLE_TOKEN_CODE,
  ATOMIC_SWAP_CODE,
  TIMELOCK_CODE,
} from './soroban-templates';

export const PROJECT_TEMPLATES = [
  {
    name: "Hello World",
    description: "A simple Soroban smart contract that returns a greeting. Perfect introduction to Stellar smart contracts.",
    icon: MessageCircle,
    code: HELLO_WORLD_CODE,
    category: "Basic",
    difficulty: "Beginner",
    features: [
      "Simple contract structure",
      "soroban_sdk basics",
      "Vec and Symbol types",
      "Contract testing",
    ],
  },
  {
    name: "Counter Contract",
    description: "A foundational Soroban contract demonstrating persistent storage and state management. Perfect starting point for learning Stellar development.",
    icon: Code2,
    code: COUNTER_CODE,
    category: "Basic",
    difficulty: "Beginner",
    features: [
      "Persistent storage",
      "Instance storage usage",
      "Increment and decrement",
      "State management",
      "Contract testing",
    ],
  },
  {
    name: "Simple Token",
    description: "A basic token implementation on Stellar/Soroban with mint, transfer, and balance tracking functionality.",
    icon: Coins,
    code: SIMPLE_TOKEN_CODE,
    category: "Token",
    difficulty: "Intermediate",
    features: [
      "Token initialization",
      "Minting capability",
      "Balance tracking",
      "Transfer functionality",
      "Admin authorization",
    ],
  },
  {
    name: "Atomic Swap",
    description: "A trustless token swap contract that allows two parties to exchange tokens atomically without intermediaries.",
    icon: ArrowLeftRight,
    code: ATOMIC_SWAP_CODE,
    category: "DeFi",
    difficulty: "Advanced",
    features: [
      "Atomic token swaps",
      "Time-bounded offers",
      "State management",
      "Token client usage",
      "Authorization patterns",
    ],
  },
  {
    name: "Timelock",
    description: "A time-locked escrow contract for Stellar tokens. Deposit tokens that can only be claimed after a specific time.",
    icon: Clock,
    code: TIMELOCK_CODE,
    category: "DeFi",
    difficulty: "Intermediate",
    features: [
      "Time-based unlocking",
      "Token escrow",
      "Ledger timestamp usage",
      "Claimant authorization",
      "Storage management",
    ],
  },
];

export interface Template {
  id?: string;
  name: string;
  description: string;
  icon: any;
  code: string;
  category: string;
  difficulty: string;
  features: string[];
  githubUrl?: string;
  documentation?: string;
  references?: Array<{
    title: string;
    url: string;
  }>;
}

export const templates: Template[] = PROJECT_TEMPLATES.map((template, index) => ({
  ...template,
  id: template.name.toLowerCase().replace(/\s+/g, '-'),
}));