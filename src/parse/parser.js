/**
 * 数学公式解析器
 */

define( function ( require ) {

    var KFParser = require( "kf" ).Parser,
        kity = require( "kity" ),
        COMPARISON_TABLE = require( "parse/def" ),
        PID_PREFIX = "_kf_editor_",
        GROUP_TYPE = "kf-editor-group",
        V_GROUP_TYPE = "kf-editor-virtual-group",
        PID = 0;

    var Parser = kity.createClass( "Parser", {

        constructor: function ( kfEditor ) {

            this.kfEditor = kfEditor;

            this.callBase();
            // kityformula 解析器
            this.kfParser = KFParser.use( "latex" );

            this.initKFormulExtension();

            this.pid = generateId();
            this.groupRecord = 0;

            this.tree = null;

            this.initServices();

        },

        parse: function ( str ) {

            var parsedResult = this.kfParser.parse( str );

            this.resetGroupId();
            // 对解析出来的结果树做适当的处理，使得编辑器能够更容易地识别当前表达式的语义
            supplementTree( this, parsedResult.tree );

            return parsedResult;

        },

        // 序列化， parse的逆过程
        serialization: function ( tree ) {

            return this.kfParser.serialization( tree );

        },

        initServices: function () {

            this.kfEditor.registerService( "parser.parse", this, {
                parse: this.parse
            } );

            this.kfEditor.registerService( "parser.latex.serialization", this, {
                serialization: this.serialization
            } );

        },

        getKFParser: function () {

            return this.kfParser;

        },

        // 初始化KF扩展
        initKFormulExtension: function () {

            require( "kf-ext/extension" ).ext( this );

        },

        resetGroupId: function () {
            this.groupRecord = 0;
        },

        getGroupId: function () {
            return this.pid + "_" + ( ++this.groupRecord );
        }

    } );

    // 把解析树丰富成公式编辑器的语义树, 该语义化的树同时也是合法的解析树
    function supplementTree ( parser, tree, parentTree ) {

        var currentOperand = null,
            // 只有根节点才没有parentTree
            isRoot = !parentTree;

        tree.attr = tree.attr || {};

        tree.attr.id = parser.getGroupId();

        tree.attr[ "data-type" ] = GROUP_TYPE;

        if ( COMPARISON_TABLE[ tree.name ] ) {
            tree.attr[ "data-type" ] = V_GROUP_TYPE;
        }

        if ( isRoot ) {
            tree.attr[ "data-root" ] = "true";
        }

        // 占位符特殊处理

        if ( tree.name === "placeholder" && parentTree ) {
            parentTree.attr[ "data-placeholder" ] = "true";
        }

        for ( var i = 0, len= tree.operand.length; i < len; i++ ) {

            currentOperand = tree.operand[ i ];

            if ( !currentOperand ) {

                tree.operand[ i ] = currentOperand;

            } else {

                if ( COMPARISON_TABLE[ tree.name ] ) {

                    if ( typeof currentOperand === "string" ) {

                        tree.operand[ i ] = {
                            name: "combination",
                            operand: [ currentOperand ],
                            attr: {
                                id: parser.getGroupId(),
                                "data-type": GROUP_TYPE
                            }
                        };

                    } else {

                        // 包裹函数的参数
                        if ( currentOperand.name !== "combination" ) {

                            tree.operand[ i ] = {
                                name: "combination",
                                operand: [ null ],
                                attr: {
                                    id: parser.getGroupId(),
                                    "data-type": GROUP_TYPE
                                }
                            };

                            tree.operand[ i ].operand[ 0 ] = supplementTree( parser, currentOperand, tree.operand[ i ] );

                        } else {

                            tree.operand[ i ] = supplementTree( parser, currentOperand, tree );

                        }

                    }

                } else {

                    if ( typeof currentOperand === "string" ) {
                        tree.operand[ i ] = currentOperand;
                    } else {
                        // 重置组类型
                        if ( !isRoot && tree.operand.length === 1 ) {
                            tree.attr[ "data-type" ] = V_GROUP_TYPE;
                        }
                        tree.operand[ i ] = supplementTree( parser, currentOperand, tree );
                    }

                }

            }

        }

        return tree;

    }

    function generateId () {
        return PID_PREFIX + ( ++PID );
    }

    return Parser;

} );

