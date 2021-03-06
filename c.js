/**
 * Created by hn on 14-3-19.
 */

( function () {

    var c = {
            start: function ( editor ) {
                kfEditor = editor;

                vCursor = document.getElementById( "cursor" );

                initvCursorHack();

                inp = document.getElementById( "hiddenInput" );

                initClick();
            }
        },
        inp = null,
        vCursor = null,
        lastCount = -1,
        cursorIndex = -1,
        currentStartOffset = -1,
        currentStartContainer = null,
        currentEndContainer = null,
        currentEndOffset = -1,
        ctrlStartContainer = null,
        ctrlStartOffset = null,
        currentGroup = null,
        isDrag = false,
        isMousedown = false,
        mousedownPoint = { x: 0, y: 0 },
        MAX_COUNT = 1000,
        CALL_COUNT = 0,
        // 移动阀值
        dragThreshold = 10,
        kfEditor = null;

    // init click
    function initClick  () {

        var evt = kfEditor.request( "ui.canvas.container.event" );

        evt.on( "mousedown", function ( e ) {

            e.preventDefault();

            isMousedown = true;
            isDrag = false;
            mousedownPoint = { x: e.clientX, y: e.clientY };

            hideCursor();

            cursorIndex = 0;

            var target = e.target,
                group = kfEditor.requestService( "position.get.group", target );

            if ( !group ) {
                group = kfEditor.requestService( "syntax.get.group.content", "_kf_editor_1_1" );
            }

            currentGroup = group;

            currentStartContainer = group;
            ctrlStartContainer = currentStartContainer;

            currentStartOffset = getIndex( currentStartContainer, e.clientX );
            ctrlStartOffset = currentStartOffset;

            if ( group ) {
                kfEditor.requestService( "render.select.group.content", group );
                kfEditor.requestService( "syntax.update.record.cursor", group.id, currentStartOffset );

                var cursorInfo = kfEditor.requestService( "syntax.get.record.cursor" );

                if ( cursorInfo.startOffset === cursorInfo.endOffset && !kfEditor.requestService( "syntax.valid.placeholder", group.id ) ) {
                    drawCursor( group, cursorInfo.startOffset );
                }

                var result = kfEditor.requestService( "syntax.get.latex.info" );

                updateInput( result );

            } else {
                kfEditor.requestService( "render.clear.select" );
            }

        } );

        evt.on( "dblclick", function ( e ) {

            e.preventDefault();

            isMousedown = false;
            isDrag = false;

            hideCursor();

            var target = e.target,
                group = kfEditor.requestService( "position.get.parent.group", target );

            if ( group ) {
                kfEditor.requestService( "render.select.group.all", group );
                var result = kfEditor.requestService( "syntax.update.selection", group );
                updateInput( result );

            } else {
                kfEditor.requestService( "render.clear.select" );
            }

        } );

        evt.on( "mouseup", function ( e ) {

            e.preventDefault();

            isMousedown = false;
            isDrag = false;

        } );

        inp.addEventListener( "keydown", function ( e ) {

            isMousedown = false;
            isDrag = false;

            hideCursor();

            switch ( e.keyCode ) {

                // left
                case 37:
                    e.preventDefault();
                    kfEditor.requestService( "syntax.cursor.move.left" );
                    update();
                    return;

                // right
                case 39:
                    e.preventDefault();
                    kfEditor.requestService( "syntax.cursor.move.right" );
                    update();
                    return;

            }

        }, false );

        function update () {

            var cursorInfo = kfEditor.requestService( "syntax.get.record.cursor" ),
                group = kfEditor.requestService( "syntax.get.group.content", cursorInfo.groupId );

            kfEditor.requestService( "render.select.group.content", group );
            if ( cursorInfo.startOffset === cursorInfo.endOffset && !kfEditor.requestService( "syntax.valid.placeholder", cursorInfo.groupId ) ) {
                drawCursor( group, cursorInfo.startOffset );
            }

            var result = kfEditor.requestService( "syntax.get.latex.info" );

            updateInput( result );

        }

        evt.on( "mousemove", function ( e ) {

            var group = null;

            e.preventDefault();

            if ( isMousedown && !isDrag && ( Math.abs( e.clientX - mousedownPoint.x ) > dragThreshold || Math.abs( e.clientY - mousedownPoint.y ) > dragThreshold ) ) {

                isDrag = true;

            }

            if ( !isDrag ) {
                return;
            }

            hideCursor();

            var group = kfEditor.requestService( "position.get.group", e.target );
            if ( !group ) {
                group = kfEditor.requestService( "syntax.get.group.content", "_kf_editor_1_1" );
            }

            currentEndContainer = kfEditor.requestService( "syntax.get.group.content", group.id );

            currentEndOffset = getMoveIndex( currentEndContainer, e.clientX );

            kfEditor.requestService( "syntax.update.record.cursor", currentEndContainer.id, currentStartOffset, currentEndOffset );
            kfEditor.requestService( "render.select.current.cursor" );

            var result = kfEditor.requestService( "syntax.get.latex.info" );

            updateInput( result );

            if ( currentStartOffset === currentEndOffset ) {
                drawCursor( currentEndContainer, currentEndOffset );
            }

        } );

        inp.oninput = function ( e ) {

            hideCursor();

            cursorIndex += inp.value.length - lastCount;
            kfEditor.requestService( "render.draw", inp.value );
            kfEditor.requestService( "render.reselect" );

            var cursorInfo = kfEditor.requestService( "syntax.get.record.cursor" ),
                group = kfEditor.requestService( "syntax.get.group.content", cursorInfo.groupId );

            drawCursor( group, cursorInfo.startOffset );

        };


        function updateInput ( result ) {

            inp.value = result.str;
            inp.startOffset = result.startOffset;
            inp.endOffset = result.endOffset;
            lastCount = result.str.length;
            inp.selectionStart = inp.startOffset;
            inp.selectionEnd = inp.endOffset;
            inp.focus();

        }

        // 修正起始容器和结束容器指向不统一的情况
        function updateContainer ( startContainer, endContainer, offset ) {

            var parent = null,
                oldChild = null,
                startIsParent = false,
                child = null;

            if ( startContainer.groupObj.contains( endContainer.groupObj ) ) {
                startIsParent = true;
                parent = startContainer;
                child = endContainer;
            } else if ( endContainer.groupObj.contains( startContainer.groupObj ) ) {
                // 结束区域更大
                parent = endContainer;
                child = startContainer;
            } else {

                parent = endContainer;
                clearCount();
                while ( parent = kfEditor.requestService( "position.get.group", parent.groupObj ) ) {
                    updateCount();

                    if ( parent.groupObj.contains( startContainer.groupObj ) ) {
                        break;
                    }

                }

                child = startContainer;

            }

            oldChild = child;
            clearCount();
            while ( child = kfEditor.requestService( "position.get.parent.group", child.groupObj ) ) {

                updateCount();
                if ( child.id === parent.id ) {
                    child = oldChild;
                    break;
                }

                oldChild = child;

            }

            currentStartContainer = parent;
            currentEndContainer = parent;

            // 起点在大的区域内
            if ( startIsParent ) {

                currentStartOffset = ctrlStartOffset;
                currentEndOffset = parent.content.indexOf( child.groupObj );

                if ( currentEndOffset >= currentStartOffset ) {
                    currentEndOffset += 1;
                }

            // 起点在小的区域内部
            } else {

                currentStartOffset = parent.content.indexOf( child.groupObj );
                currentEndOffset = getOffset( parent, offset );

                if ( offset < mousedownPoint.x ) {
                    currentStartOffset += 1;
                } else {
                    currentEndOffset += 1;
                }

            }

        }

        // 返回在索引指定的位置插入光标，也就是说该索引的位置是在当前元素“之前”
        function getIndex ( group, offset ) {

            var index = getOffset( group, offset ),
                overflow = -1,
                // 点击是否在前半段
                box = null;

            box = group.content[ index ].getBoundingClientRect();

            overflow = offset - box.left;

            if ( overflow > box.width / 2 ) {
                index += 1;
            }

            return index;

        }

        function getOffset ( group, offset ) {

            var index = -1,
                box = null;

            kity.Utils.each( group.content, function ( child, i ) {

                index = i;

                box = child.getBoundingClientRect();

                if ( box.left + box.width > offset ) {
                    return false;
                }

            } );

            return index;

        }

        function getMoveIndex ( group, offset ) {

            currentStartContainer = ctrlStartContainer;
            currentStartOffset = ctrlStartOffset;

            // 直接更新
            if ( ctrlStartContainer.id !== group.id ) {
                updateContainer( ctrlStartContainer, group, offset );
                return currentEndOffset;
            }

            var index = -1,
                box = null,
                overflow = -1;

            kity.Utils.each( group.content, function ( child, i ) {

                index = i;

                box = child.getBoundingClientRect();

                if ( box.left + box.width > offset ) {
                    return false;
                }

            } );

            box = group.content[ index ].getBoundingClientRect();

            overflow = offset - box.left;

            // 向后走
            if ( index >= ctrlStartOffset ) {

                if ( overflow > box.width / 3 ) {
                    index += 1;
                }

            // 向前走
            } else {

                // 光标还在默认边界范围内
                if ( overflow > box.width / 3 * 2 ) {
                    index += 1;
                }

            }

            return index;

        }

        function hideCursor () {
            vCursor.style.display = 'none';
        }

        function drawCursor ( group, index ) {

            var target = null,
                isBefore = true,
                prevBox = null,
                box = null;

            // 定位到最后
            if ( index === group.content.length ) {
                index -= 1;
                isBefore = false;
            }

            target = group.content[ index ];

            box = target.getBoundingClientRect();

            prevBox = group.content[ index - 1 ] || target;
            prevBox = prevBox.getBoundingClientRect();

            if ( isBefore ) {
                vCursor.style.left = box.left - 1 + "px";
            } else {
                vCursor.style.left = box.left + box.width + 1 + "px";
            }

            vCursor.style.height = prevBox.height + "px";
            vCursor.style.top = prevBox.top + "px";
            vCursor.style.display = "block";

        }

    }

    function initvCursorHack () {

        vCursor.addEventListener( "mouseup", function () {
            isMousedown = false;
            isDrag = false;
        } );

    }

    function clearCount () {
        CALL_COUNT = 0;
    }

    function updateCount () {
        CALL_COUNT++;
        if ( CALL_COUNT > MAX_COUNT ) {
            throw new Error("stack overflow");
        }
    }

    window.c = c;

} )();