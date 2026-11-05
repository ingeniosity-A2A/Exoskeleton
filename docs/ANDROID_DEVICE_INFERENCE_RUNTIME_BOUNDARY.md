# Android Device and Inference Runtime Boundary

**Recorded:** 2026-11-05  
**Repository:** `ingeniosity-A2A/Exoskeleton`  
**Status:** Architecture boundary; no device runtime or accelerator is certified by this document  
**Authority:** Exoskeleton defines runtime and capability contracts. Ava007 Omni-OS owns device/OS interfaces. AVA-007 retains cognitive, acceptance, curation, and action authority.

## 1. The S26 Ultra is the execution host

The Samsung Galaxy S26 Ultra is a physical Android device with an ARM64 execution environment and device-provided compute resources. It is **not** ONNX Runtime, does not become ONNX Runtime by hosting a model, and must not be represented as an inference runtime.

Keep these layers distinct:

| Layer | Meaning | What must be verified |
|---|---|---|
| Samsung Galaxy S26 Ultra | Physical device / execution host | Exact model, firmware, Android build, SoC and exposed capabilities |
| Android / ARM64 | Operating system and ABI | API level, ABI, permissions, process and service constraints |
| CPU / GPU / NPU | Hardware compute resources | Supported driver/API path and actual execution evidence |
| Model artifact | Weights and model format, such as ONNX | Format, opset, quantization, architecture, license and checksums |
| Inference runtime | Software that loads and executes a model | Exact runtime/library version, supported operators and backend |
| Execution provider / delegate | Runtime-to-hardware adapter | Provider availability, compatibility and proof of selected device execution |

A model file is not a runtime. An execution provider is not hardware. Installing a runtime is not proof that a GPU or NPU is being used.

## 2. ONNX Runtime is optional

ONNX Runtime is a software inference runtime. It is **not** a mandatory Exoskeleton dependency and is not an assumed system component on the S26 Ultra.

An ONNX Runtime adapter may be introduced only when all of the following are true:

1. The runtime is explicitly selected, installed or packaged, and version-pinned.
2. Its Android ABI and API requirements match the target build.
3. The exact model loads and executes with supported operators.
4. The selected execution provider is reported by runtime diagnostics.
5. CPU, GPU or NPU execution is distinguished using provider logs and device-side evidence.
6. Accuracy, latency, memory, thermal behavior, energy where measurable, and fallback behavior are tested on the target device.

If those conditions are not met, do not claim ONNX Runtime integration or accelerator execution. Do not add ONNX Runtime merely because a model is distributed in ONNX format.

## 3. Device capability discovery precedes runtime selection

Omni-OS must expose a capability record based on the actual device and installed software. At minimum, record:

- device model and build fingerprint;
- Android API level and supported ABI;
- SoC identification where available;
- available CPU features and process constraints;
- GPU vendor, driver, supported graphics/compute APIs;
- NPU/DSP vendor interface and runtime availability, if exposed;
- installed inference runtimes, versions and supported execution providers;
- model format, operators, quantization and memory requirements;
- observed provider selection, fallback, errors and device-side execution evidence.

Do not infer NPU availability from the marketing name of a chipset, an Android API, a runtime package, or a successful model-load operation. Do not infer GPU/NPU use from a benchmark that does not identify the execution provider.

## 4. Ownership and integration boundary

```text
Cybernetic-Ava007
  cognitive purpose · reasoning · acceptance · authorization
                 |
                 v
Exoskeleton
  runtime contracts · scheduling · lifecycle · memory · evidence
                 |
                 v
Ava007 Omni-OS
  Android device interface · capability discovery · runtime adapters
                 |
                 v
Samsung Galaxy S26 Ultra
  physical ARM64 host · Android OS · exposed compute resources
```

- **Cybernetic-Ava007** owns cognitive purpose, model/skill acceptance, curation and action authorization.
- **Exoskeleton** owns runtime-neutral capability contracts, lifecycle, scheduling, observability and evidence requirements.
- **Ava007 Omni-OS** owns Android APIs, device discovery, installed runtime adapters and hardware-facing integration.
- **MA-Edge-Computing** owns the edge/A2A communication and deployment interfaces; it must consume verified device capabilities rather than invent them.

Runtime adapters remain replaceable. ONNX Runtime, Qualcomm GenieX or another vendor/runtime SDK are separate software options; none is the S26 Ultra itself. Any specific SDK/device compatibility must be verified against its official support matrix and a target-device run.

## 5. Acceptance and non-claims

A device execution claim must include the exact device/build, runtime and provider versions, model hash, command or app build, raw logs, execution target, latency distribution, peak memory, thermal/power observations where available, and fallback behavior.

Use these status labels precisely:

- **Specified:** the interface or requirement is documented.
- **Implemented:** adapter source is present.
- **Built:** the exact target artifact was produced.
- **Executed:** the model ran on the named device/runtime.
- **Accelerated:** device-side evidence confirms the named GPU/NPU provider actually executed the workload.
- **Accepted:** the AVA-007-controlled task-quality and operational criteria passed.

This document establishes the architecture boundary only. It does not claim that ONNX Runtime is installed, that GenieX is active, or that the S26 Ultra's GPU/NPU has been accessed or benchmarked.
