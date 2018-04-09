import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {$get, $transform} from 'plow-js';
import {Button, Icon, IconButton, Tabs} from '@neos-project/react-ui-components';
import {connect} from 'react-redux';
import {actions} from '@neos-project/neos-ui-redux-store';
import {neos} from '@neos-project/neos-ui-decorators';
import {fetchWithErrorHandling} from '@neos-project/neos-ui-backend-connector';
import mergeClassNames from 'classnames';
import style from './style.css';

@neos(globalRegistry => ({
    options: globalRegistry.get('frontendConfiguration').get('Psmb_FlatNav')
}))
@connect($transform({}), {
    add: actions.CR.Nodes.add
})
export default class FlatNavContainer extends Component {
    state = {};

    constructor(props) {
        super(props);
        Object.keys(this.props.options.presets).forEach(preset => {
            this.state[preset] = {
                page: 1,
                isLoading: false,
                nodes: []
            };
        });
    }

    makeFetchNodes = preset => () => {
        this.setState({
            [preset]: {
                isLoading: true,
                page: this.state[preset].page,
                nodes: this.state[preset].nodes
            }
        });
        fetchWithErrorHandling.withCsrfToken(csrfToken => ({
            url: `/flatnav/query?preset=${preset}&page=${this.state[preset].page}`,
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Flow-Csrftoken': csrfToken,
                'Content-Type': 'application/json'
            }
        }))
            .then(response => response && response.json())
            .then(nodes => {
                const nodesMap = nodes.reduce((result, node) => {
                    result[node.contextPath] = node;
                    return result;
                }, {});
                this.props.add(nodesMap);
                this.setState({
                    [preset]: {
                        isLoading: false,
                        page: this.state[preset].page + 1,
                        nodes: [...this.state[preset].nodes, ...Object.keys(nodesMap)]
                    }
                });
            });
    };

    render() {
        return (
            <Tabs>
                {Object.keys(this.props.options.presets).map(presetName => {
                    const preset = this.props.options.presets[presetName];
                    return (
                        <Tabs.Panel key={presetName} title={preset.label} icon={preset.icon}>
                            <FlatNav preset={preset} fetchNodes={this.makeFetchNodes(presetName)} {...this.state[presetName]} />
                        </Tabs.Panel>
                    );
                })}
            </Tabs>
        );
    }
}

@neos(globalRegistry => ({
    nodeTypesRegistry: globalRegistry.get('@neos-project/neos-ui-contentrepository')
}))
@connect($transform({
    nodeData: $get('cr.nodes.byContextPath'),
    focused: $get('ui.pageTree.isFocused'),
    siteNodeContextPath: $get('cr.nodes.siteNode')
}), {
    setSrc: actions.UI.ContentCanvas.setSrc,
    focus: actions.UI.PageTree.focus,
    openNodeCreationDialog: actions.UI.NodeCreationDialog.open,
    commenceNodeCreation: actions.CR.Nodes.commenceCreation,
    selectNodeType: actions.UI.SelectNodeTypeModal.apply
})
class FlatNav extends Component {
    static propTypes = {
        nodes: PropTypes.array.isRequired,
        preset: PropTypes.object.isRequired,
        isLoading: PropTypes.bool.isRequired,
        page: PropTypes.number.isRequired
    };

    componentDidMount() {
        if (this.props.nodes.length === 0) {
            this.props.fetchNodes();
        }
    }

    createNode = () => {
        const context = this.props.siteNodeContextPath.split('@')[1];
        const contextPath = this.props.preset.newReferenceNodePath + '@' + context;
        this.props.commenceNodeCreation(contextPath);
        this.props.selectNodeType('into', this.props.preset.newNodeType);
    }

    renderNodes = () => {
        return this.props.nodes
            .map(contextPath => {
                const item = $get([contextPath], this.props.nodeData);
                const nodeTypeName = $get('nodeType', item);
                const nodeType = this.props.nodeTypesRegistry.getNodeType(nodeTypeName);
                return (
                    <div
                        className={mergeClassNames({
                            [style.node]: true,
                            [style['node--focused']]: this.props.focused === contextPath
                        })}
                        key={contextPath}
                        onClick={() => {
                            this.props.setSrc($get('uri', item));
                            this.props.focus(contextPath);
                        }}
                        role="button"
                        >
                        <Icon icon={$get('ui.icon', nodeType)} /> {$get('label', item)}
                    </div>
                );
            });
    };

    render() {
        return (
            <div style={{overflow: 'hidden'}}>
                <div style={{overflowY: 'auto'}}>
                    <div className={style.toolbar}>
                        <IconButton icon="plus" onClick={this.createNode}/>
                    </div>

                    {this.renderNodes()}

                    <Button
                        onClick={this.props.fetchNodes}
                        style="clean"
                        className={style.loadMoreButton}
                        isDisabled={this.props.isLoading}
                    >
                        <div style={{textAlign: 'center'}}>
                            <Icon
                                spin={this.props.isLoading}
                                icon={this.props.isLoading ? 'spinner' : 'angle-double-down'}
                            />
                            &nbsp;{this.props.isLoading ? 'Loading...' : 'Load more'}
                        </div>
                    </Button>
                </div>
            </div>
        );
    }
}
