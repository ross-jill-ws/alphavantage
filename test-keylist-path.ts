#!/usr/bin/env bun

/**
 * Test that .keylist can be found from different working directories
 */

import { getKey } from "./src/business";

async function testKeylistPath() {
  console.log("Testing .keylist path resolution...\n");

  const originalCwd = process.cwd();
  console.log(`Original working directory: ${originalCwd}`);

  try {
    // Test 1: From project root
    console.log("\n=== Test 1: From project root ===");
    process.chdir(originalCwd);
    console.log(`Current directory: ${process.cwd()}`);
    const key1 = await getKey();
    console.log(`✓ Successfully loaded API key: ${key1.substring(0, 5)}...`);

    // Test 2: From /tmp directory
    console.log("\n=== Test 2: From /tmp directory ===");
    process.chdir("/tmp");
    console.log(`Current directory: ${process.cwd()}`);
    const key2 = await getKey();
    console.log(`✓ Successfully loaded API key: ${key2.substring(0, 5)}...`);

    // Test 3: From src directory
    console.log("\n=== Test 3: From src directory ===");
    process.chdir(`${originalCwd}/src`);
    console.log(`Current directory: ${process.cwd()}`);
    const key3 = await getKey();
    console.log(`✓ Successfully loaded API key: ${key3.substring(0, 5)}...`);

    console.log("\n=== All Tests Passed! ===");
    console.log("✓ .keylist can be found from any working directory");
    console.log("✓ Path resolution is working correctly");

  } catch (error) {
    console.error("\n❌ Test Failed:", error);
    process.exit(1);
  } finally {
    // Restore original working directory
    process.chdir(originalCwd);
  }
}

testKeylistPath();
