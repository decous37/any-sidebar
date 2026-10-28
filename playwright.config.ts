import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/e2e',timeout:45000,workers:1,reporter:[['list'],['json',{outputFile:'artifacts/verification/e2e-results.json'}]],webServer:{command:'node scripts/serve-fixtures.mjs',url:'http://127.0.0.1:4173/article.html',reuseExistingServer:true}});
