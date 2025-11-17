import { ref } from 'vue'
import { useVueFlow } from '@vue-flow/core'

export function useContextMenu() {
  const { onPaneContextMenu, onNodeContextMenu, addNodes, removeNodes, screenToFlowCoordinate } = useVueFlow()

  const menuShow = ref(false)
  const menuTop = ref(0)
  const menuLeft = ref(0)
  let menuNode = null

  function showMenu(event, node) {
    event.preventDefault()
    menuShow.value = true
    menuTop.value = event.clientY
    menuLeft.value = event.clientX
    menuNode = node
  }

  onPaneContextMenu((event) => {
    showMenu(event)
  })

  onNodeContextMenu(({ event, node }) => {
    showMenu(event, node)
  })

  function addNode() {
    const position = screenToFlowCoordinate({
      x: menuLeft.value,
      y: menuTop.value,
    })

    const newNode = {
      id: `random_node-${Math.random()}`,
      type: 'process',
      position,
      data: { status: null, title: '新节点', properties: { prop1: 'value1', prop2: 'value2' } },
    }

    addNodes([newNode])
    menuShow.value = false
  }

  function deleteNode() {
    if (menuNode) {
      removeNodes([menuNode.id])
    }
    menuShow.value = false
  }

  return {
    menuShow,
    menuTop,
    menuLeft,
    addNode,
    deleteNode,
  }
}
