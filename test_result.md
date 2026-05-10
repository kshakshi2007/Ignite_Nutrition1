#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  In the Fuel tab the meal plan should be generated according to user location, and the user should
  be able to manually add meals. In the Core tab (dashboard) it should show calories, protein, etc.
  according to the user's logged meals.

backend:
  - task: "Location-aware meal plan generation"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /api/meal-plan/generate now accepts optional `location`. Mercury prompt requests dishes authentic to the region and returns calories/protein/carbs/fat per meal. Location is persisted on the user document."
        - working: true
          agent: "testing"
          comment: "Verified end-to-end. POST /api/meal-plan/generate with body {location:'Mumbai, India'} returns the correct shape: breakfast/lunch/dinner/snack each with name, reason, and numeric calories/protein/carbs/fat. Response.location echoes 'Mumbai, India'. /api/auth/me confirms user.location='Mumbai, India' is persisted. /api/meal-plan/latest returns the saved doc. When Mercury-2 produces valid JSON, dishes are clearly Indian (Poha with peas, Chicken tikka masala with brown rice, Grilled pomfret with millet roti, Bombay-style fish curry, Masala oats, Greek yogurt with mango, etc.). Minor: Mercury-2 occasionally returns empty content (0 tokens) or omits some keys, causing the server's fallback ('Balanced bowl' with default macros) to kick in for ~1 of 3 calls. Server-side handling is correct, but the LLM reliability hurts UX. Consider increasing max_tokens (current 900) and/or retrying once on empty/missing-key responses."

  - task: "Custom meal macro estimation"
    implemented: true
    working: false
    file: "/app/backend/server.py"
    stuck_count: 1
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "New POST /api/meals/estimate-macros endpoint. Takes meal name + optional notes, returns calories/protein/carbs/fat/portion estimated by Mercury."
        - working: false
          agent: "testing"
          comment: "CRITICAL: Endpoint returns shape correctly but values are always the hardcoded fallback (calories=400, protein=20, carbs=45, fat=15, portion='1 serving') for every meal name tried (2 eggs and toast, Grilled chicken salad, Bowl of oatmeal with banana, Cheeseburger and fries, Greek yogurt with honey). Root cause: max_tokens=200 is too low for the mercury-2 model — direct calls to mercury-2 with the same prompt produce truncated responses cut off mid-JSON near the closing `\"portion\": \"1 serving\"}` (e.g. '{\"calories\": 220, \"protein\": 14, \"carbs\": 16, \"fat\": 11, \"portion\": \"1' [EOF]). The trailing `}` is missing so extract_json's `{...}` regex fails and returns {}, then the endpoint silently falls back to defaults. Mercury-2 also occasionally returns empty strings. FIX: raise max_tokens to ~350-500 in /api/meals/estimate-macros and consider one retry when extract_json returns {}. Also recommend logging raw Mercury response when JSON parse fails so this doesn't go silently unnoticed."

  - task: "Progress entries store macros"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "ProgressIn now accepts optional calories/protein/carbs/fat. POST /api/progress persists them. GET /api/progress returns them so frontend can sum daily totals."
        - working: true
          agent: "testing"
          comment: "Verified. POST /api/progress with {title:'Test meal', type:'meal', mealType:'lunch', calories:500, protein:30, carbs:60, fat:15} returns 200 with all fields echoed. GET /api/progress lists the entry with calories=500, protein=30, carbs=60, fat=15 intact. Existing fields (title, type, mealType) also round-trip correctly."

frontend:
  - task: "Fuel tab — location detection + manual meal modal"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/meal-plan.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added expo-location auto-detect + manual edit. New Add modal lets user type a meal, AI estimates macros, and logs to progress. Generated meal plan now shows kcal pill + P/C/F chips."

  - task: "Core tab — macro tracking from logged meals"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/dashboard.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Dashboard now sums today's logged meal macros, shows calorie progress bar against target, and protein/carbs/fat cards with sub-targets. Fixed earlier syntax errors and missing Screen import."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 4
  run_ui: false

test_plan:
  current_focus:
    - "Custom meal macro estimation"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: "Added 3 backend changes (location-aware /meal-plan/generate, /meals/estimate-macros, macros on progress) and 2 frontend updates (Fuel location+manual modal, Core macro dashboard). Please test the 3 backend tasks. Use credentials in /app/memory/test_credentials.md. Validate that meal plan respects a passed location, that estimate-macros returns numeric calories/protein/carbs/fat, and that progress payload + listing roundtrips macro fields."
    - agent: "testing"
      message: "Backend retest done with smoke1@ignite.app. Results: (1) Location-aware meal plan: WORKING — body.location accepted, response echoes it, user.location persists, /meal-plan/latest returns saved doc, and dishes are clearly Indian when Mercury responds (Poha, Chicken tikka masala, Bombay fish curry, Masala oats, etc.). Mercury-2 occasionally returns empty/incomplete JSON ⇒ server fallback ('Balanced bowl' defaults) — minor reliability issue, recommend retry-on-empty. (2) /api/meals/estimate-macros: BROKEN — every meal returns the exact fallback values (cal=400/P=20/C=45/F=15/portion='1 serving'). Root cause: max_tokens=200 is too small for mercury-2 — direct probe shows the JSON is truncated mid `\"portion\"` field, so extract_json gets no closing brace and returns {}, falling through to defaults. Fix: bump max_tokens to ~350-500 for this endpoint and add a retry/log when extract_json yields empty. (3) Progress macros: WORKING — POST and GET both round-trip calories/protein/carbs/fat. Regression: /auth/me, /scan/analyze (text), /chat/send (authed), /recipes list/create — all PASS. Test script saved at /app/backend_test.py."
