# Reduce Memory Usage

现代扩散模型（Flux、Wan 等）参数量巨大，单卡推理常遇 OOM。核心思路：多 GPU 分布式、CPU offload、精度降低。

> 不同模型架构（Transformer vs UNet）对各种优化的收益不同，需针对性调整。

## 1. 多 GPU

依赖 Accelerate 库：

```bash
pip install -U accelerate
```

### 1.1 分片检查点（Sharded Checkpoints）

将大模型存为多个分片，只加载当前分片，降低峰值显存。推荐 fp32 模型 > 5GB 时使用。

```python
# 保存分片
unet.save_pretrained("sdxl-unet-sharded", max_shard_size="5GB")

# 加载分片
unet = AutoModel.from_pretrained("username/sdxl-unet-sharded", torch_dtype=torch.float16)
pipeline = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    unet=unet,
    torch_dtype=torch.float16,
).to("cuda")
```

### 1.2 Device Map

`device_map` 控制模型组件或层在设备间的分布。

**balanced 策略**：均匀分布 pipeline 组件到所有 GPU：

```python
pipeline = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
    device_map="balanced",
)
print(pipeline.hf_device_map)
# {'unet': 1, 'vae': 1, 'safety_checker': 0, 'text_encoder': 0}
```

**auto 策略**：大模型按层自动分配，优先填满最快设备。Flux 12.5B 参数模型示例：

```python
transformer = AutoModel.from_pretrained(
    "black-forest-labs/FLUX.1-dev",
    subfolder="transformer",
    device_map="auto",
    torch_dtype=torch.bfloat16,
)
```

**自定义 device_map**：精确控制每层位置，GPU 用整数、CPU 用 `"cpu"`、硬盘用 `"disk"`。

```python
device_map = {
    'single_transformer_blocks.10': 1,  # 第 2 块 GPU
    'single_transformer_blocks.21': 'cpu',  # CPU
}
```

**`max_memory` 限制**：限制每设备最大显存。

```python
max_memory = {0: "1GB", 1: "1GB"}
pipeline = StableDiffusionXLPipeline.from_pretrained(
    "...", torch_dtype=torch.float16, device_map="balanced", max_memory=max_memory,
)
```

> 使用 device_map 后，需调用 `pipeline.reset_device_map()` 才能再用 `.to()`、`enable_sequential_cpu_offload()` 等方法。

## 2. VAE Slicing

分批解码，批量生成时显著降峰值（如一次 4 张，只逐张 decode）。单张无性能影响。

```python
pipeline.enable_vae_slicing()
```

> `AutoencoderKLWan` 和 `AsymmetricAutoencoderKL` 不支持。

## 3. VAE Tiling

将图像分割为小块逐块处理，降峰值。低于阈值（如 SD 默认 512×512）自动禁用。拼接处无明显接缝，但可能有色调差异。

```python
pipeline.enable_vae_tiling()
```

> `AutoencoderKLWan` 和 `AsymmetricAutoencoderKL` 不支持。

## 4. Offloading

### 4.1 CPU Offloading（Sequential）

逐子模块在 GPU/CPU 间切换，极致省显存但**极慢**。

```python
pipeline = DiffusionPipeline.from_pretrained(
    "black-forest-labs/FLUX.1-schnell", torch_dtype=torch.bfloat16,
)
# 注意：不要先 .to("cuda")，否则省不了显存
pipeline.enable_sequential_cpu_offload()
```

### 4.2 Model Offloading

以完整模型为单位切换，比 Sequential 快，但省显存效果不如。

```python
pipeline = DiffusionPipeline.from_pretrained(
    "black-forest-labs/FLUX.1-schnell", torch_dtype=torch.bfloat16,
)
pipeline.enable_model_cpu_offload()
```

### 4.3 Group Offloading（新）

将层组（`ModuleList`/`Sequential`）整体切换。介于 Model 和 Sequential 之间，兼顾速度和显存。

**两种粒度**：
- `block_level`：按 `num_blocks_per_group` 分组，如 40 层、2 层一组 = 20 次切换
- `leaf_level`：单层粒度，等同 CPU offloading，但可搭配 stream 加速

**整 pipeline 启用**：

```python
pipeline.enable_group_offload(
    onload_device=torch.device("cuda"),
    offload_device=torch.device("cpu"),
    offload_type="leaf_level",
    use_stream=True,
)
```

**分组件启用**（更灵活）：

```python
# Diffusers 模型用 enable_group_offload
pipeline.transformer.enable_group_offload(
    onload_device=onload_device, offload_type="leaf_level",
)

# 通用 torch.nn.Module 用 apply_group_offloading
from diffusers.hooks import apply_group_offloading
apply_group_offloading(
    pipeline.text_encoder, onload_device=onload_device,
    offload_type="block_level", num_blocks_per_group=2,
)
```

### 4.4 CUDA Stream

`use_stream=True` 交叉传输与计算（层预取），加速 group offloading。需 2x 模型大小的 CPU 内存。`record_stream=True` 进一步提速轻微增加显存。

```python
pipeline.transformer.enable_group_offload(
    ..., use_stream=True, record_stream=True, low_cpu_mem_usage=True,
)
```

> `block_level` + stream 时，`num_blocks_per_group` 应设为 1。

### 4.5 Offload 到硬盘

内存不够时 offload 到磁盘：

```python
pipeline.transformer.enable_group_offload(
    ..., offload_to_disk_path="path/to/disk",
)
```

## 5. Layerwise Casting

权重以低精度存储（如 fp8），计算时上转换到 fp16/bf16。norm/modulation 层跳过避免质量下降。

**搭配 group offloading 获得最大显存节省。**

```python
transformer = CogVideoXTransformer3DModel.from_pretrained(
    "THUDM/CogVideoX-5b", subfolder="transformer", torch_dtype=torch.bfloat16,
)
transformer.enable_layerwise_casting(
    storage_dtype=torch.float8_e4m3fn, compute_dtype=torch.bfloat16,
)
```

**精细化控制**：

```python
from diffusers.hooks import apply_layerwise_casting

apply_layerwise_casting(
    transformer,
    storage_dtype=torch.float8_e4m3fn,
    compute_dtype=torch.bfloat16,
    skip_modules_classes=["norm"],  # 跳过 normalization 层
    non_blocking=True,
)
```

> 不兼容：forward 中有内部权重类型转换的模型、部分 PEFT 自定义实现。

## 6. torch.channels_last

内存布局从 NCHW 转为 NHWC，对齐硬件顺序访问，减少显存跳跃。

```python
pipeline.unet.to(memory_format=torch.channels_last)
```

## 7. Memory-Efficient Attention

通过 `set_attention_backend()` 切换 attention 后端：FlashAttention、xFormers、SageAttention 等。详见 [Attention Backends 指南](https://huggingface.co/docs/diffusers/optimization/attention_backends)。

## 优先级速查

| 优先级 | 方法 | 显存节省 | 性能影响 |
|--------|------|----------|----------|
| 1 | FP16 / BF16 | ~50% | 无 |
| 2 | VAE Slicing / Tiling | 峰值降 | 无/略慢 |
| 3 | Layerwise Casting (fp8) | ~50% | 略慢 |
| 4 | Sharded Checkpoints | 加载峰值降 | 无 |
| 5 | Group Offload (block) | 中等 | 略慢 |
| 6 | Model Offload | 高 | 变慢 |
| 7 | Sequential Offload | 极致 | 极慢 |
| 8 | Offload to Disk | 极致 | 极慢 |
