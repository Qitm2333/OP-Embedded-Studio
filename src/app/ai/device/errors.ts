export interface DeviceDeploymentProblem {
  title: string
  cause: string
  action: string
  retryLabel: string
  recovery: 'retry' | 'reprepare' | 'initialize'
  detail?: string
}

export function describeDeviceDeploymentProblem(message: string): DeviceDeploymentProblem {
  const detail = message.trim() || '设备部署未完成'

  if (/容量|capacity|too large|exceed/iu.test(detail)) {
    return {
      title: '内容超过设备容量',
      cause: '当前画面或交互编码后的数据超过了设备可写入的内容分区。',
      action: '减少交互画面数量或图片内容后，重新准备烧录。',
      retryLabel: '重新准备',
      recovery: 'reprepare',
      detail
    }
  }
  if (/不支持 Web Serial|Web Serial/iu.test(detail)) {
    return {
      title: '当前浏览器无法访问 USB 串口',
      cause: '当前运行环境没有提供 Web Serial 能力。',
      action: '请使用最新版 Chrome 或 Edge 打开 Studio，再重新选择设备。',
      retryLabel: '重新选择设备',
      recovery: 'retry',
      detail
    }
  }
  if (/No port selected|NotFoundError|AbortError|未选择.*设备|用户.*取消/iu.test(detail)) {
    return {
      title: '尚未选择 USB 设备',
      cause: '系统设备选择窗口已关闭，Studio 还没有获得可用串口。',
      action: '重新执行烧录，并在系统设备窗口中选择开发板对应的串口。',
      retryLabel: '重新选择设备',
      recovery: 'retry',
      detail
    }
  }
  if (/permission|SecurityError|NotAllowedError|denied|权限|授权/iu.test(detail)) {
    return {
      title: 'USB 串口权限未授予',
      cause: '浏览器或系统拒绝了当前页面的串口访问请求。',
      action: '允许当前页面访问串口；若设备未出现，请重新插拔 USB 后再试。',
      retryLabel: '重新授权',
      recovery: 'retry',
      detail
    }
  }
  if (/不兼容|协议|握手失败|未运行.*基础固件|设备分辨率.*不匹配/iu.test(detail)) {
    return {
      title: '设备固件与当前烧录方式不兼容',
      cause: '设备没有运行匹配当前屏幕方案的 OPUSB 基础固件。',
      action: '确认重新初始化基础固件。该操作会替换设备上的旧运行固件，再写入当前内容。',
      retryLabel: '初始化并继续',
      recovery: 'initialize',
      detail
    }
  }
  if (/变化|stale|重新生成|重新准备/iu.test(detail)) {
    return {
      title: '烧录内容已经变化',
      cause: '画布或目标屏幕在确认后发生了变化，旧计划已不能代表当前内容。',
      action: '重新点击烧录入口，生成与当前画布一致的新计划。',
      retryLabel: '重新准备',
      recovery: 'reprepare',
      detail
    }
  }
  if (/不存在|not found|无法渲染|不是可烧录|请选择.*Frame|请选择.*图片/iu.test(detail)) {
    return {
      title: '没有可用的烧录画面',
      cause: '原计划引用的 Frame 或图片已经不存在，或者当前选择无法渲染。',
      action: '在画布中选择一个 Frame 或图片；多选画面时请使用交互烧录入口。',
      retryLabel: '重新准备',
      recovery: 'reprepare',
      detail
    }
  }
  if (/断开|timeout|超时|数据流不可用|reconnect/iu.test(detail)) {
    return {
      title: 'USB 连接中断',
      cause: '烧录期间串口断开、响应超时或数据流不可用。',
      action: '确认数据线支持传输并重新插拔设备，然后再次执行烧录。',
      retryLabel: '重新连接',
      recovery: 'retry',
      detail
    }
  }
  if (/busy|already open|正在使用|占用|锁定/iu.test(detail)) {
    return {
      title: 'USB 串口正被其他程序占用',
      cause: '另一个程序或浏览器页面正在使用开发板串口。',
      action: '关闭串口监视器和其他烧录工具，再重新选择设备。',
      retryLabel: '重新选择设备',
      recovery: 'retry',
      detail
    }
  }
  if (/另一个.*任务|正在执行/iu.test(detail)) {
    return {
      title: '已有烧录任务正在运行',
      cause: 'Studio 同一时间只能执行一个 USB 写入任务。',
      action: '等待当前任务完成后，再执行这个烧录计划。',
      retryLabel: '再次执行',
      recovery: 'retry',
      detail
    }
  }
  if (/固件分区|固件清单|manifest|无法读取固件|Failed to fetch/iu.test(detail)) {
    return {
      title: '基础固件资源读取失败',
      cause: 'Studio 无法读取当前屏幕方案需要的基础固件文件。',
      action: '检查网络和本地固件资源后重新执行；若持续失败，请重新启动 Studio。',
      retryLabel: '重新读取',
      recovery: 'retry',
      detail
    }
  }
  if (/尚未提供|不支持.*快速|unsupported/iu.test(detail)) {
    return {
      title: '当前屏幕暂不支持这种烧录方式',
      cause: '当前屏幕方案没有对应的 USB 快速烧录固件。',
      action: '切换到已支持 USB 快速烧录的屏幕方案，或使用设备面板中的其他传输方式。',
      retryLabel: '重新准备',
      recovery: 'reprepare',
      detail
    }
  }
  return {
    title: '烧录未完成',
    cause: detail,
    action: '检查 USB 连接和设备状态后再次执行；技术细节可在下方执行日志中查看。',
    retryLabel: '再次执行',
    recovery: 'retry'
  }
}
