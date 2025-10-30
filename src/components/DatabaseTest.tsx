import React, { useState } from 'react';
import { Database, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const DatabaseTest: React.FC = () => {
  const { user } = useAuth();
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const runTests = async () => {
    setTesting(true);
    setResults([]);
    const testResults: any[] = [];

    // Test database functions first
    console.log('🧪 Testing database functions...');
    try {
      // Test uid() function
      console.log('🧪 Testing uid() function...');
      const { data: uidTest, error: uidError } = await supabase.rpc('uid');
      console.log('🧪 uid() function result:', uidTest, 'error:', uidError);
      
      testResults.push({
        name: 'uid() Function Test',
        success: !uidError && uidTest === user?.id,
        duration: 'N/A',
        details: uidError ? uidError.message : `uid() returned: ${uidTest}`,
        data: { expected: user?.id, actual: uidTest }
      });
      
      // Test email validation function
      if (user?.email) {
        console.log('🧪 Testing is_biirdee_email() function...');
        const { data: emailTest, error: emailError } = await supabase.rpc('is_biirdee_email', { email_address: user.email });
        console.log('🧪 is_biirdee_email() function result:', emailTest, 'error:', emailError);
        
        testResults.push({
          name: 'is_biirdee_email() Function Test',
          success: !emailError && emailTest === true,
          duration: 'N/A',
          details: emailError ? emailError.message : `Function returned: ${emailTest}`,
          data: { email: user.email, result: emailTest }
        });
      }
    } catch (funcError) {
      console.error('🧪 Database function test failed:', funcError);
      testResults.push({
        name: 'Database Functions Test',
        success: false,
        duration: 'Failed',
        details: 'Functions may not exist in database: ' + String(funcError)
      });
    }

    // Test 1: Basic connection
    try {
      const start = Date.now();
      const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
      const duration = Date.now() - start;
      testResults.push({
        name: 'Basic Connection',
        success: !error,
        duration: `${duration}ms`,
        details: error ? error.message : 'Connection successful'
      });
    } catch (err) {
      testResults.push({
        name: 'Basic Connection',
        success: false,
        duration: 'Failed',
        details: String(err)
      });
    }

    // Test 2: Profile query (with auth)
    if (user) {
      try {
        const start = Date.now();
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id);
        const duration = Date.now() - start;
        testResults.push({
          name: 'Profile Query (Authenticated)',
          success: !error,
          duration: `${duration}ms`,
          details: error ? error.message : `Found ${data?.length || 0} profile(s)`,
          data: data
        });
      } catch (err) {
        testResults.push({
          name: 'Profile Query (Authenticated)',
          success: false,
          duration: 'Failed',
          details: String(err)
        });
      }

      // Test 3: Profile insertion (test RLS insert policy)
      try {
        const start = Date.now();
        const { error } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email || '',
            full_name: 'Test User'
          })
          .select();
        const duration = Date.now() - start;
        testResults.push({
          name: 'Profile Insert (RLS Test)',
          success: !error || error.code === '23505', // 23505 = duplicate key (already exists)
          duration: `${duration}ms`,
          details: error ? 
            (error.code === '23505' ? 'Profile already exists (good)' : error.message) : 
            'Insert successful'
        });
      } catch (err) {
        testResults.push({
          name: 'Profile Insert (RLS Test)',
          success: false,
          duration: 'Failed',
          details: String(err)
        });
      }

      // Test 4: Proposals query
      try {
        const start = Date.now();
        const { data, error } = await supabase
          .from('proposals')
          .select('*')
          .eq('user_id', user.id);
        const duration = Date.now() - start;
        testResults.push({
          name: 'Proposals Query',
          success: !error,
          duration: `${duration}ms`,
          details: error ? error.message : `Found ${data?.length || 0} proposal(s)`,
          data: data
        });
      } catch (err) {
        testResults.push({
          name: 'Proposals Query',
          success: false,
          duration: 'Failed',
          details: String(err)
        });
      }
    }

    setResults(testResults);
    setTesting(false);
  };

  if (!user) return null;

  return (
    <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700 rounded-xl p-6 mb-6 shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <Database className="h-5 w-5 text-accent-400" />
        <h3 className="text-lg font-semibold text-white">System Health Check</h3>
        <button
          onClick={runTests}
          disabled={testing}
          className="ml-auto bg-gradient-to-r from-accent-600 to-accent-700 hover:from-accent-500 hover:to-accent-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-sm shadow-lg transform hover:scale-105 transition-all duration-200"
        >
          {testing ? 'Testing...' : 'Run Tests'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((result, index) => (
            <div key={index} className={`p-3 rounded border ${
              result.success 
                ? 'bg-green-500/10 border-green-500/20' 
                : 'bg-red-500/10 border-red-500/20'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                )}
                <span className={`font-medium ${result.success ? 'text-green-300' : 'text-red-300'}`}>
                  {result.name}
                </span>
                <span className="text-xs text-gray-400">({result.duration})</span>
              </div>
              <div className="text-sm text-gray-300 mb-2">{result.details}</div>
              {result.data && (
                <details className="text-xs text-gray-400">
                  <summary className="cursor-pointer hover:text-gray-300">View Data</summary>
                  <pre className="mt-2 p-2 bg-gray-800 rounded overflow-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        <p>This test checks database connectivity and RLS policies.</p>
        <p>User ID: {user.id}</p>
        <p>Email: {user.email}</p>
      </div>
    </div>
  );
};

export default DatabaseTest;