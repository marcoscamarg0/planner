const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Fetching heavy reports...");
  const { data: reports, error } = await supabase
    .from('qa_reports')
    .select('id, result_json')
    .eq('type', 'smart_runner')
    .not('result_json', 'is', null);

  if (error) {
    console.error("Error fetching:", error);
    return;
  }

  console.log(`Found ${reports.length} reports. Checking for heavy payloads...`);

  let fixed = 0;
  for (const report of reports) {
    if (!report.result_json) continue;
    
    let needsUpdate = false;
    let json = typeof report.result_json === 'string' ? JSON.parse(report.result_json) : report.result_json;

    if (json.finalScreenshot) {
      delete json.finalScreenshot;
      needsUpdate = true;
    }

    if (json.steps && Array.isArray(json.steps)) {
      json.steps = json.steps.map(s => {
        if (s.screenshotBase64) {
          delete s.screenshotBase64;
          needsUpdate = true;
        }
        return s;
      });
    }

    if (needsUpdate) {
      console.log(`Updating report ${report.id} to remove base64 strings...`);
      await supabase
        .from('qa_reports')
        .update({ 
          result_json: json,
          result_raw: JSON.stringify(json)
        })
        .eq('id', report.id);
      fixed++;
    }
  }

  console.log(`Done! Fixed ${fixed} heavy reports.`);
}

run();
