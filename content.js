// 创建悬浮球元素
function createFloatingBall() {
  // 检查是否已存在悬浮球，避免重复创建
  if (document.getElementById('floating-counter-ball')) {
    return;
  }

  // 创建悬浮球容器
  const ball = document.createElement('div');
  ball.id = 'floating-counter-ball';
  
  // 创建计数显示元素
  const counter = document.createElement('span');
  counter.id = 'counter-number';
  
  // 从存储中获取当前计数
  chrome.storage.local.get(['counterValue', 'visitedUrls'], function(result) {
    const count = result.counterValue || 0;
    counter.textContent = count;
    
    // 初始化访问过的URL列表
    visitedUrls = result.visitedUrls || [];
  });
  
  // 从存储中获取位置信息
  chrome.storage.local.get(['ballPosition'], function(result) {
    if (result.ballPosition) {
      ball.style.top = result.ballPosition.top + 'px';
      ball.style.right = result.ballPosition.right + 'px';
      // 当有保存的位置时，移除默认的垂直居中
      ball.style.transform = 'none';
    }
  });
  
  // 将计数元素添加到悬浮球中
  ball.appendChild(counter);
  
  // 添加点击事件（左键点击）
  ball.addEventListener('click', function(e) {
    // 如果是拖动操作完成后的点击事件，不处理
    if (wasDragging) {
      wasDragging = false;
      return;
    }
    
    // 增加计数并格式化剪贴板文本
    incrementCounter();
    formatClipboardText();
    e.stopPropagation();
  });
  
  // 添加右键菜单
  ball.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY);
  });
  
  // 添加拖动功能
  makeDraggable(ball);
  
  // 将悬浮球添加到页面
  document.body.appendChild(ball);
}

// 全局变量存储已访问的URL和鼠标状态
let visitedUrls = [];
let isDragging = false;
let wasDragging = false;
let dragStartX = 0;
let dragStartY = 0;
const DRAG_THRESHOLD = 5; // 拖动阈值，单位像素

// 增加计数器值
function incrementCounter() {
  // 获取当前URL
  const currentUrl = window.location.href;
  
  // 检查URL是否已经访问过
  if (visitedUrls.includes(currentUrl)) {
    return; // 如果已访问过，不增加计数
  }
  
  // 获取当前计数
  chrome.storage.local.get(['counterValue', 'visitedUrls'], function(result) {
    const currentCount = result.counterValue || 0;
    const newCount = currentCount + 1;
    
    // 添加当前URL到已访问列表
    visitedUrls = result.visitedUrls || [];
    visitedUrls.push(currentUrl);
    
    // 更新存储中的计数和URL列表
    chrome.storage.local.set({
      counterValue: newCount,
      visitedUrls: visitedUrls
    }, function() {
      // 更新显示
      const counterElement = document.getElementById('counter-number');
      if (counterElement) {
        counterElement.textContent = newCount;
      }
    });
  });
}

// 显示上下文菜单
function showContextMenu(x, y) {
  // 移除已有的菜单
  removeContextMenu();
  
  // 创建菜单容器
  const menu = document.createElement('div');
  menu.id = 'floating-ball-context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  
  // 创建清零选项
  const resetOption = document.createElement('div');
  resetOption.className = 'menu-option';
  resetOption.textContent = '清零并复制URL';
  resetOption.addEventListener('click', resetCounterAndCopyUrls);
  
  // 将选项添加到菜单
  menu.appendChild(resetOption);
  
  // 添加到页面
  document.body.appendChild(menu);
  
  // 点击页面其他地方关闭菜单
  setTimeout(() => {
    document.addEventListener('click', removeContextMenu, { once: true });
  }, 0);
}

// 移除上下文菜单
function removeContextMenu() {
  const menu = document.getElementById('floating-ball-context-menu');
  if (menu) {
    menu.remove();
  }
}

// 清零计数器并复制URL列表
function resetCounterAndCopyUrls() {
  chrome.storage.local.get(['visitedUrls'], function(result) {
    const urls = result.visitedUrls || [];
    
    // 复制URL列表到剪贴板
    const urlText = urls.join('\n');
    copyToClipboard(urlText);
    
    // 清零计数器和URL列表
    chrome.storage.local.set({
      counterValue: 0,
      visitedUrls: []
    }, function() {
      // 更新显示
      const counterElement = document.getElementById('counter-number');
      if (counterElement) {
        counterElement.textContent = '0';
      }
      
      // 重置全局变量
      visitedUrls = [];
      
      // 显示提示
      showToast('已清零，URL列表已复制到剪贴板');
    });
  });
  
  // 关闭菜单
  removeContextMenu();
}

// 格式化剪贴板文本
function formatClipboardText() {
  // 读取剪贴板内容
  navigator.clipboard.readText()
    .then(text => {
      // 替换英文引号为中文全角双引号（按奇偶位置）
      let formattedText = text;
      
      // 按照奇偶位置替换引号
      // 查找所有引号位置
      const quotePositions = [];
      let searchIndex = 0;
      let foundIndex;
      
      // 找出所有引号的位置
      while ((foundIndex = formattedText.indexOf('"', searchIndex)) !== -1) {
        quotePositions.push(foundIndex);
        searchIndex = foundIndex + 1;
      }
      
      // 从后向前替换，避免位置变化
      for (let i = quotePositions.length - 1; i >= 0; i--) {
        const position = quotePositions[i];
        const replacement = i % 2 === 0 ? '“' : '”'; // 奇数位置用开引号，偶数位置用闭引号
        formattedText = formattedText.substring(0, position) + replacement + formattedText.substring(position + 1);
      }
      
      // 替换英文省略号为中文省略号
      formattedText = formattedText.replace(/\.{6}/g, '……');
      formattedText = formattedText.replace(/\.{3}/g, '…');
      
      // 复制格式化后的文本到剪贴板
      copyToClipboard(formattedText);
      
      // 显示提示
      showToast('剪贴板文本已格式化');
    })
    .catch(err => {
      console.error('读取剪贴板失败: ', err);
      // 不在点击时显示错误提示，避免影响用户体验
    });
}

// 复制文本到剪贴板
function copyToClipboard(text) {
  // 尝试使用现代API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .catch(err => {
        console.error('复制到剪贴板失败: ', err);
        // 如果API失败，回退到传统方法
        fallbackCopyToClipboard(text);
      });
  } else {
    // 回退到传统方法
    fallbackCopyToClipboard(text);
  }
}

// 传统方式复制到剪贴板
function fallbackCopyToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  
  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('复制失败: ', err);
    showToast('复制失败，请手动复制');
  }
  
  document.body.removeChild(textarea);
}

// 显示提示消息
function showToast(message) {
  const toast = document.createElement('div');
  toast.id = 'floating-ball-toast';
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // 2秒后自动消失
  setTimeout(() => {
    toast.remove();
  }, 2000);
}

// 使元素可拖动
function makeDraggable(element) {
  let initialX, initialY;
  let currentX, currentY;
  let xOffset = 0;
  let yOffset = 0;
  
  element.addEventListener('mousedown', dragStart);
  document.addEventListener('mouseup', dragEnd);
  document.addEventListener('mousemove', drag);
  
  // 开始拖动
  function dragStart(e) {
    // 如果是右键点击，不启动拖动
    if (e.button === 2) {
      return;
    }
    
    // 记录初始位置
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    
    // 获取当前元素位置
    const rect = element.getBoundingClientRect();
    xOffset = e.clientX - rect.left;
    yOffset = e.clientY - rect.top;
    
    // 不立即设置为拖动状态
    isDragging = false;
    wasDragging = false;
    
    e.preventDefault();
  }
  
  // 拖动过程
  function drag(e) {
    // 只有鼠标按下时才处理
    if (dragStartX === 0 && dragStartY === 0) {
      return;
    }
    
    // 计算移动距离
    const moveX = Math.abs(e.clientX - dragStartX);
    const moveY = Math.abs(e.clientY - dragStartY);
    
    // 如果移动距离超过阈值，才开始拖动
    if (!isDragging && (moveX > DRAG_THRESHOLD || moveY > DRAG_THRESHOLD)) {
      isDragging = true;
      wasDragging = true;
    }
    
    // 只有在拖动状态下才移动元素
    if (isDragging) {
      e.preventDefault();
      
      currentX = e.clientX - xOffset;
      currentY = e.clientY - yOffset;
      
      // 限制不超出屏幕边界
      const ballWidth = element.offsetWidth;
      const ballHeight = element.offsetHeight;
      const maxX = window.innerWidth - ballWidth;
      const maxY = window.innerHeight - ballHeight;
      
      currentX = Math.max(0, Math.min(currentX, maxX));
      currentY = Math.max(0, Math.min(currentY, maxY));
      
      // 设置新位置
      element.style.left = currentX + 'px';
      element.style.top = currentY + 'px';
      element.style.right = 'auto'; // 取消右侧定位
      element.style.transform = 'none'; // 取消垂直居中变换
      
      // 保存位置到存储
      const rightPosition = window.innerWidth - currentX - ballWidth;
      savePosition(currentY, rightPosition);
    }
  }
  
  // 结束拖动
  function dragEnd(e) {
    // 重置初始位置
    dragStartX = 0;
    dragStartY = 0;
    
    // 如果是拖动状态，则标记为已拖动
    if (isDragging) {
      isDragging = false;
      // wasDragging 保持为 true，直到下一次点击
    }
  }
  
  // 保存位置到存储
  function savePosition(top, right) {
    chrome.storage.local.set({
      ballPosition: {
        top: top,
        right: right
      }
    });
  }
}

// 页面加载完成后创建悬浮球
window.addEventListener('load', function() {
  createFloatingBall();
}); 