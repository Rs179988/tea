# Repository Guidelines for TEA (Traffic Engineering Anything)

## Core Philosophy

TEA operates on **Ground-Truth Traffic Observations**. 
It eliminates AI guesswork when integrating with undocumented, closed, or legacy APIs. 

1. **Evidence First**: All endpoints, headers, query parameters, and payload types must originate from verified network traces (HAR, PCAP, WebSocket frame captures).
2. **Deterministic Inference**: Schema unification must handle variations across multiple observations without hallucinating fields. If a field was observed only in 1 of 5 responses, it must be typed as optional (`field?: type`).
3. **Clean-Room Code Synthesis**: Synthesized SDKs must be completely standalone, idiomatic, and unencumbered by external proprietary dependencies. Pure Fetch API is preferred over heavy third-party HTTP clients.
4. **Dual Interface**: Every core capability must be available both via the CLI (`tea <command>`) and the Model Context Protocol (MCP) server for autonomous agents.
