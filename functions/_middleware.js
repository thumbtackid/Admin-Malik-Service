// functions/_middleware.js
export async function onRequest(context) {
  const { request, next } = context;
  
  // CORS headers untuk semua response
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  
  // Log request
  console.log(`${request.method} ${request.url}`);
  
  // Proses request
  const response = await next();
  
  // Tambahkan CORS headers ke response
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}
