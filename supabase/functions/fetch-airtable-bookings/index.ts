import { corsHeaders } from '../_shared/cors.ts';

interface AirtableBooking {
  id: string;
  fields: {
    'Booking Name': string;
    'Sales Agent': {
      email: string;
      name: string;
    };
    'Booking Status': string;
    'Class': string;
    'Sales Price': number;
    'PNR': string;
    'From': string;
    'To': string;
    'Airline Carrier': string;
    'Start Date': string;
    'Booking Notes': string;
    'BookingId': number;
    [key: string]: any;
  };
  createdTime: string;
}

Deno.serve(async (req: Request) => {
  console.log('🔍 Edge Function called - Method:', req.method);
  console.log('🔍 Edge Function called - URL:', req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling CORS preflight request');
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('🚀 Starting simplified Airtable fetch...');
    
    // Get query parameters
    const url = new URL(req.url);
    const searchQuery = url.searchParams.get('query') || '';
    console.log('🔎 Search query received:', JSON.stringify(searchQuery));
    
    // Get Airtable credentials from environment
    const airtableToken = Deno.env.get('AIRTABLE_TOKEN');
    const airtableBaseId = Deno.env.get('AIRTABLE_BASE_ID');
    const airtableTableId = Deno.env.get('AIRTABLE_TABLE_ID');

    console.log('🔑 Environment variables check:');
    console.log('- AIRTABLE_TOKEN exists:', !!airtableToken);
    console.log('- AIRTABLE_BASE_ID:', airtableBaseId);
    console.log('- AIRTABLE_TABLE_ID:', airtableTableId);
    
    if (!airtableToken || !airtableBaseId || !airtableTableId) {
      console.error('❌ Missing Airtable credentials');
      return new Response(
        JSON.stringify({ 
          error: 'Airtable credentials not configured',
          missing: {
            token: !airtableToken,
            baseId: !airtableBaseId,
            tableId: !airtableTableId
          }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Basic headers for Airtable API
    const headers = {
      'Authorization': `Bearer ${airtableToken}`,
      'Content-Type': 'application/json',
    };
    
    console.log('📋 Request headers prepared');
    console.log('- Authorization header length:', headers.Authorization.length);
    console.log('- Token starts with "pat":', airtableToken.startsWith('pat'));

    // Direct URL to the table as specified by user
    const directTableUrl = `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableId}`;
    console.log('🎯 Direct table URL:', directTableUrl);

    // Add basic parameters to limit results
    const params = new URLSearchParams();
    params.append('maxRecords', '50');
    
    // If we have a search query, add a simple filter
    if (searchQuery && searchQuery.trim()) {
      console.log('🔍 Adding search filter for query:', searchQuery);
      // Case-insensitive search in Booking Name field only
      const filterFormula = `SEARCH(LOWER("${searchQuery}"), LOWER({Booking Name} & "")) > 0`;
      params.append('filterByFormula', filterFormula);
      console.log('🔍 Filter formula:', filterFormula);
    } else {
      console.log('📋 No search query - fetching all records (up to maxRecords limit)');
    }

    const fullUrl = `${directTableUrl}?${params.toString()}`;
    console.log('🌐 Full request URL:', fullUrl);
    
    // Make the API request
    console.log('📡 Making GET request to Airtable...');
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: headers,
    });
    
    console.log('📥 Response received - Status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
    
    // Get response body
    const responseText = await response.text();
    console.log('📄 Response body (first 1000 chars):', responseText.substring(0, 1000));
    
    if (!response.ok) {
      console.error('❌ Airtable API request failed');
      console.error('- Status:', response.status);
      console.error('- Status Text:', response.statusText);
      console.error('- Response body:', responseText);
      
      let errorDetails;
      try {
        errorDetails = JSON.parse(responseText);
      } catch {
        errorDetails = { message: responseText };
      }
      
      return new Response(
        JSON.stringify({ 
          error: `Airtable API request failed: ${response.status}`,
          details: errorDetails,
          debugInfo: {
            url: fullUrl,
            status: response.status,
            statusText: response.statusText,
            hasToken: !!airtableToken,
            tokenFormat: airtableToken.startsWith('pat') ? 'PAT format' : 'Other format',
            tokenLength: airtableToken.length,
            baseId: airtableBaseId,
            tableId: airtableTableId,
            searchQuery: searchQuery
          }
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ Airtable API request successful!');
    
    // Parse the successful response
    const data = JSON.parse(responseText);
    console.log('📊 Records found:', data.records?.length || 0);
    
    if (data.records && data.records.length > 0) {
      console.log('📋 Sample record fields:', Object.keys(data.records[0].fields || {}));
      console.log('📋 First record sample:', JSON.stringify(data.records[0], null, 2));
    }

    // Transform records to our expected format
    const transformedRecords = (data.records || []).map((record: AirtableBooking) => ({
      id: record.id,
      airtable_record_id: record.id,
      booking_name: record.fields['Booking Name'] || 'Unnamed Booking',
      sales_agent_email: record.fields['Sales Agent']?.email || '',
      sales_agent_name: record.fields['Sales Agent']?.name || '',
      booking_status: record.fields['Booking Status'] || '',
      class: record.fields['Class'] || '',
      sales_price: record.fields['Sales Price'] || 0,
      pnr: record.fields['PNR'] || '',
      from_airport: record.fields['From'] || '',
      to_airport: record.fields['To'] || '',
      airline_carrier: record.fields['Airline Carrier'] || '',
      start_date: record.fields['Start Date'] || '',
      booking_notes: record.fields['Booking Notes'] || '',
      booking_id: record.fields['BookingId'] || 0,
      created_time: record.createdTime,
      raw_data: record.fields
    }));

    console.log('📤 Returning', transformedRecords.length, 'transformed records');

    return new Response(
      JSON.stringify({
        records: transformedRecords,
        count: transformedRecords.length,
        debugInfo: {
          baseId: airtableBaseId,
          tableId: airtableTableId,
          searchQuery: searchQuery,
          rawRecordCount: data.records?.length || 0
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Edge Function error:');
    console.error('- Error type:', error.constructor.name);
    console.error('- Error message:', error.message);
    console.error('- Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
        type: error.constructor.name
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});