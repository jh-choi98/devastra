Follow this process for discussion and implementation:

1. First, read documents under `/docs/` as appropriate to grasp this project's planning, design, architecture, and design intent. Use multiple Explore agents in parallel if needed.
2. If there are points that need further specification or technical discussion to implement this work, present them to the user and continue the discussion.
3. When the user judges the discussion sufficient and instructs you to write the implementation plan, first read `/prompts/task-create.md` carefully. Then draft a multi-phase implementation plan in that format and request feedback from the user, including any open discussion points.
4. When the user judges the discussion sufficient and instructs you to create the task, generate the task and phase files following the format and procedure in `/prompts/task-create.md`.
5. Run `scripts/run-phases.py` to execute each phase in sequence.
6. After `scripts/run-phases.py` exits, send a Discord notification to the user based on the exit code:
   - **exit 0 (success)**: All phases completed. Send `✅ Task {name} done (N phases)`.
   - **exit 1 (error)**: An error occurred during phase execution. Read `error_message` from the task's index.json and send `❌ Task {name} phase {n} failed: {error}`.
   - **exit 2 (blocked)**: User intervention required. Read `blocked_reason` from the task's index.json and send `⚠️ Task {name} phase {n} blocked: {reason}`.
