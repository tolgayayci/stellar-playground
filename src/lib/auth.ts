import { supabase } from './supabase';
import { User } from '@/lib/types';
import { HELLO_WORLD_CODE, COUNTER_CODE } from './soroban-templates';

export async function createInitialProjects(userId: string) {
  try {
    console.log('Creating initial projects for user:', userId);
    
    // Check if user already has projects to avoid duplicates
    const { data: existingProjects, error: checkError } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', userId)
      .limit(1);
    
    if (checkError) {
      console.error('Error checking existing projects:', checkError);
      // Continue anyway - better to try creating than fail completely
    }
    
    if (existingProjects && existingProjects.length > 0) {
      console.log('User already has projects, skipping initial project creation');
      return;
    }

    // Create both projects in a single batch operation
    const { error } = await supabase
      .from('projects')
      .insert([
        {
          user_id: userId,
          name: 'Hello World',
          description: 'A simple Hello World smart contract to get started with Stellar',
          code: HELLO_WORLD_CODE,
        },
        {
          user_id: userId,
          name: 'Counter',
          description: 'A basic counter smart contract demonstrating Soroban state management',
          code: COUNTER_CODE,
        }
      ]);

    if (error) throw error;
    
    console.log('Initial projects created successfully for user:', userId);
  } catch (error) {
    console.error('Error creating initial projects:', error);
    throw error;
  }
}


export async function signInWithMagicLink(email: string) {
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/projects`,
      },
    });

    if (error) throw error;

    return { 
      data, 
      error: null, 
      status: 'magic_link_sent' 
    };
  } catch (error) {
    console.error('Magic link error:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Failed to send magic link'),
      status: 'error'
    };
  }
}

export async function signInWithGitHub() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/projects`,
      },
    });

    if (error) throw error;

    return { 
      data, 
      error: null, 
      status: 'oauth_redirect' 
    };
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Failed to sign in with GitHub'),
      status: 'error'
    };
  }
}


export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    // Get user data from users table
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
      
    if (error) throw error;
    
    // If user record doesn't exist in users table, create it
    if (!data) {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
        })
        .select()
        .single();
        
      if (insertError) throw insertError;
      return newUser;
    }
    
    return data;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}