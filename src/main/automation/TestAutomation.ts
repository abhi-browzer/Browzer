/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BrowserAutomationExecutor } from './BrowserAutomationExecutor';
import type {
  ToolExecutionResult
} from '@/shared/types';

/**
 * Test Automation for GitHub New Repository Form
 * 
 * This is a static test to verify the automation system works correctly
 * without requiring LLM integration.
 */
export class TestAutomation {
  private executor: BrowserAutomationExecutor;
  private results: ToolExecutionResult[] = [];

  constructor(executor: BrowserAutomationExecutor) {
    this.executor = executor;
  }

  /**
   * Execute GitHub new repository form automation
   */
  public async executeGitHubNewRepoTest(): Promise<{
    success: boolean;
    results: ToolExecutionResult[];
    summary: string;
  }> {
    console.log('🧪 [TestAutomation] Starting GitHub new repository form test...');
    this.results = [];

    try {
      // Step 1: Wait for page to be ready (GitHub uses id="repository-name-input")
      console.log('Step 1: Waiting for repository name input...');
      const waitResult = await this.executor.waitForElement({
        selector: '#repository-name-input',
        state: 'visible',
        timeout: 5000
      });
      this.results.push(waitResult);

      if (!waitResult.success) {
        return this.createTestResult(false, 'Failed to find repository name input');
      }

      // Step 2: Type repository name
      console.log('Step 2: Typing repository name...');
      const typeNameResult = await this.executor.type({
        selector: '#repository-name-input',
        backupSelectors: [
          'input[aria-describedby*="RepoNameInput"]',
          'input[data-component="input"][type="text"]',
          'input[aria-required="true"][type="text"]'
        ],
        text: 'test-automation-repo-2',
        clearFirst: true,
        waitForElement: 500
      });
      this.results.push(typeNameResult);

      if (!typeNameResult.success) {
        return this.createTestResult(false, 'Failed to type repository name');
      }

      await this.sleep(500);

      // Step 3: Type description (optional) - GitHub uses name="Description" (capital D)
      console.log('Step 3: Typing repository description...');
      const typeDescResult = await this.executor.type({
        selector: 'input[name="Description"]',
        backupSelectors: [
          'input[aria-describedby*="caption"]',
          'input[data-component="input"][type="text"]:not(#repository-name-input)',
          'input.prc-components-Input-Ic-y8[type="text"]:nth-of-type(2)'
        ],
        text: 'Test repository created by automation system',
        clearFirst: true,
        waitForElement: 500
      });
      this.results.push(typeDescResult);

      // Continue even if description fails (it's optional)
      await this.sleep(500);

      // Step 4: Scroll down to see more options
      console.log('Step 4: Scrolling down...');
      const scrollResult = await this.executor.scroll({
        direction: 'down',
        amount: 300
      });
      this.results.push(scrollResult);

      await this.sleep(500);

      // Step 5: Check "Add a README file" checkbox
      console.log('Step 5: Checking README checkbox...');
      const checkboxResult = await this.executor.checkbox({
        selector: 'input[type="checkbox"][data-component="checkbox"]',
        backupSelectors: [
          'input[type="checkbox"]',
          'input.prc-components-Checkbox-checkbox-Checkbox-checkbox-rrDWD',
          'input[aria-describedby*="checkbox"]'
        ],
        checked: true,
        waitForElement: 500
      });
      this.results.push(checkboxResult);

      await this.sleep(500);

      // Step 6: Scroll to create button
      console.log('Step 6: Scrolling to create button...');
      const scrollToButtonResult = await this.executor.scroll({
        direction: 'down',
        amount: 200
      });
      this.results.push(scrollToButtonResult);

      await this.sleep(500);

      // Step 7: Click "Create repository" button
      console.log('Step 7: Clicking create repository button...');
      const clickCreateResult = await this.executor.click({
        selector: 'button[type="submit"]',
        backupSelectors: [
          'button[data-disable-with*="Creating"]',
          'form button[type="submit"]',
          'button.btn-primary[type="submit"]'
        ],
        waitForElement: 1000,
        verifyVisible: true
      });
      this.results.push(clickCreateResult);

      if (!clickCreateResult.success) {
        return this.createTestResult(false, 'Failed to click create repository button');
      }

      // Test completed successfully
      return this.createTestResult(true, 'GitHub new repository form automation completed successfully');

    } catch (error) {
      console.error('🧪 [TestAutomation] Test failed with error:', error);
      return this.createTestResult(false, `Test failed with error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute a simpler test - just click and type
   */
  public async executeSimpleClickTest(): Promise<{
    success: boolean;
    results: ToolExecutionResult[];
    summary: string;
  }> {
    console.log('🧪 [TestAutomation] Starting simple click test...');
    this.results = [];

    try {
      // Just click the repository name input to focus it
      const clickResult = await this.executor.click({
        selector: '#repository-name-input',
        backupSelectors: [
          'input[aria-describedby*="RepoNameInput"]',
          'input[data-component="input"][type="text"]',
          'input[aria-required="true"][type="text"]'
        ],
        waitForElement: 1000
      });
      this.results.push(clickResult);

      if (!clickResult.success) {
        return this.createTestResult(false, 'Failed to click repository name input');
      }

      await this.sleep(300);

      // Type something
      const typeResult = await this.executor.type({
        selector: '#repository-name-input',
        backupSelectors: [
          'input[aria-describedby*="RepoNameInput"]',
          'input[data-component="input"][type="text"]'
        ],
        text: 'hello-world-test',
        clearFirst: true,
        waitForElement: 500
      });
      this.results.push(typeResult);

      if (!typeResult.success) {
        return this.createTestResult(false, 'Failed to type in repository name input');
      }

      return this.createTestResult(true, 'Simple click and type test completed successfully');

    } catch (error) {
      console.error('🧪 [TestAutomation] Simple test failed:', error);
      return this.createTestResult(false, `Test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all execution results
   */
  public getResults(): ToolExecutionResult[] {
    return this.results;
  }

  private createTestResult(success: boolean, summary: string): {
    success: boolean;
    results: ToolExecutionResult[];
    summary: string;
  } {
    return {
      success,
      results: this.results,
      summary
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
