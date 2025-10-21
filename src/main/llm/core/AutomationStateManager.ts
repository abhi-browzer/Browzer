/* eslint-disable @typescript-eslint/no-explicit-any */
import { AutomationState, ExecutedStep, CompletedPlan } from './types';
import { ParsedAutomationPlan } from '../parsers/AutomationPlanParser';
import { RecordingSession } from '@/shared/types/recording';
import { SystemPromptBuilder } from '../builders/SystemPromptBuilder';
import Anthropic from '@anthropic-ai/sdk';

/**
 * AutomationStateManager - Manages automation session state
 * 
 * Responsibilities:
 * - Initialize and maintain automation state
 * - Track executed steps and completed plans
 * - Manage conversation history
 * - Handle phase transitions
 * - Provide state queries and updates
 * 
 * This module centralizes all state management logic, making it easy to:
 * - Debug state issues
 * - Add new state fields
 * - Implement state persistence
 * - Track automation progress
 */
export class AutomationStateManager {
  private state: AutomationState;

  constructor(
    userGoal: string,
    recordedSession: RecordingSession,
    maxRecoveryAttempts: number
  ) {
    this.state = this.initializeState(userGoal, recordedSession, maxRecoveryAttempts);
  }

  /**
   * Initialize automation state
   */
  private initializeState(
    userGoal: string,
    recordedSession: RecordingSession | undefined,
    maxRecoveryAttempts: number
  ): AutomationState {
    return {
      userGoal,
      recordedSession,
      cachedContext: SystemPromptBuilder.formatRecordedSession(recordedSession),
      messages: [],
      executedSteps: [],
      phaseNumber: 1,
      completedPlans: [],
      isInRecovery: false,
      recoveryAttempts: 0,
      maxRecoveryAttempts,
      isComplete: false,
      finalSuccess: false
    };
  }

  /**
   * Get current state (read-only)
   */
  public getState(): Readonly<AutomationState> {
    return this.state;
  }

  /**
   * Set current plan
   */
  public setCurrentPlan(plan: ParsedAutomationPlan): void {
    this.state.currentPlan = plan;
  }

  /**
   * Add message to conversation history
   */
  public addMessage(message: Anthropic.MessageParam): void {
    this.state.messages.push(message);
  }

  /**
   * Add executed step
   */
  public addExecutedStep(step: ExecutedStep): void {
    this.state.executedSteps.push(step);
  }

  /**
   * Mark as in recovery mode
   */
  public enterRecoveryMode(): void {
    this.state.isInRecovery = true;
    this.state.recoveryAttempts++;
  }

  /**
   * Exit recovery mode
   */
  public exitRecoveryMode(): void {
    this.state.isInRecovery = false;
  }

  /**
   * Complete current phase and move to next
   */
  public completePhase(): void {
    if (this.state.currentPlan) {
      this.state.completedPlans.push({
        phaseNumber: this.state.phaseNumber,
        plan: this.state.currentPlan,
        stepsExecuted: this.state.currentPlan.totalSteps
      });
      this.state.phaseNumber++;
    }
  }

  /**
   * Mark automation as complete
   */
  public markComplete(success: boolean, error?: string): void {
    this.state.isComplete = true;
    this.state.finalSuccess = success;
    this.state.finalError = error;
  }

  /**
   * Check if max recovery attempts reached
   */
  public isMaxRecoveryAttemptsReached(): boolean {
    return this.state.recoveryAttempts > this.state.maxRecoveryAttempts;
  }

  /**
   * Get conversation messages
   */
  public getMessages(): Anthropic.MessageParam[] {
    return this.state.messages;
  }

  /**
   * Get cached context (recorded session)
   */
  public getCachedContext(): string | undefined {
    return this.state.cachedContext;
  }

  /**
   * Get current plan
   */
  public getCurrentPlan(): ParsedAutomationPlan | undefined {
    return this.state.currentPlan;
  }

  /**
   * Get executed steps
   */
  public getExecutedSteps(): ExecutedStep[] {
    return this.state.executedSteps;
  }

  /**
   * Get user goal
   */
  public getUserGoal(): string {
    return this.state.userGoal;
  }

  /**
   * Check if in recovery mode
   */
  public isInRecovery(): boolean {
    return this.state.isInRecovery;
  }

  /**
   * Check if complete
   */
  public isComplete(): boolean {
    return this.state.isComplete;
  }

  /**
   * Get recovery attempts count
   */
  public getRecoveryAttempts(): number {
    return this.state.recoveryAttempts;
  }

  /**
   * Get total steps executed
   */
  public getTotalStepsExecuted(): number {
    return this.state.executedSteps.length;
  }

  /**
   * Get final result
   */
  public getFinalResult(): { success: boolean; error?: string } {
    return {
      success: this.state.finalSuccess,
      error: this.state.finalError
    };
  }

  /**
   * Get completed plans
   */
  public getCompletedPlans(): CompletedPlan[] {
    return this.state.completedPlans;
  }

  /**
   * Get last completed plan
   */
  public getLastCompletedPlan(): CompletedPlan | undefined {
    return this.state.completedPlans[this.state.completedPlans.length - 1];
  }
}
