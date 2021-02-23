import React from 'react';
import golos from 'golos-classic-js';
import { Link } from 'react-router';
import tt from 'counterpart';
import Icon from 'app/components/elements/Icon';
import TimeAgoWrapper from 'app/components/elements/TimeAgoWrapper';
import Remarkable from 'remarkable';
import remarkableStripper from 'app/utils/RemarkableStripper';
import { detransliterate } from 'app/utils/ParsersAndFormatters';
import truncate from 'lodash/truncate';
import Pagination from 'rc-pagination';
if (typeof(document) !== 'undefined') require('rc-pagination/assets/index.css');
let Multiselect;
if (typeof(document) !== 'undefined') Multiselect = require('multiselect-react-dropdown').Multiselect;

const remarkable = new Remarkable({ html: true, linkify: false })

class Search extends React.Component {
    constructor(props) {
        super(props);
        const {routeParams} = props;
        this.state = {
            query: '',
            queryOp: 'match',
            page: 1,
            where: tt('search.where_posts'),
            dateFrom: '',
            dateTo: '',
            authorLookup: [],
            author: routeParams.author || '',
            tagLookup: [],
            tags: []
        };
    }

    componentDidMount() {
        this.fetchSearch(1);
    }

    onChange = (e) => {
        let query = e.target.value;
        let queryTrimmed = query.trim();
        let queryOp = 'match';
        if (queryTrimmed.length >= 3 && queryTrimmed[0] === '"' && queryTrimmed[queryTrimmed.length - 1] === '"') {
            queryOp = 'match_phrase';
        }
        this.setState({
            query,
            queryOp
        });
    };

    fetchSearch = async (page) => {
        let sort = {};
        let main = [];
        if (this.state.query) {
            main = [{
                "bool": {
                    "should": [
                        {
                            [this.state.queryOp]: {
                                "title": this.state.query
                            }
                        },
                        {
                            [this.state.queryOp]: {
                                "body": this.state.query
                            }
                        } 
                    ]
                }
            }];
        } else {
            sort = {
                "sort": {
                    "created": {
                        "order": "desc"
                    }
                }
            };
        }

        let filters = [];
        if (this.state.where === tt('search.where_posts')) {
            filters.push({
                "term": {
                    "depth": 0
                }
            });
        } else if (this.state.where === tt('search.where_comments')) {
            filters.push({
                "bool": {
                    "must_not": {
                        "term": {
                            "depth": 0
                        }
                    }
                }
            });
        }
        if (this.state.dateFrom || this.state.dateTo) {
            let range = {
                "range": {
                    "created": {
                    }
                }
            };
            if (this.state.dateFrom) {
                range.range.created.gte = this.state.dateFrom + 'T00:00:00';
            }
            if (this.state.dateTo) {
                range.range.created.lte = this.state.dateTo;
            }
            filters.push(range);
        }
        if (this.state.author) {
            filters.push({
                "term": {
                    "author": this.state.author
                }
            });
        }
        if (this.state.tags.length) {
            for (let tag of this.state.tags)
            filters.push({
                "term": {
                    "tags": tag
                }
            });
        }

        let url = new URL($STM_Config.elastic_search.url);
        url += 'blog/post/_search?pretty';
        let body = {
            "_source": false,
            "from": (page - 1) * 20,
            "size": 20,
            "query": {
                "bool": {
                    "should": {
                        "bool": {
                            "must_not": {
                                "match_phrase_prefix": {
                                    "category": "fm-"
                                }
                            },
                        }
                    },
                    "must": [
                        ...main,
                        ...filters
                    ]
                }
            },
            ...sort,
            "highlight": {
                "fragment_size" : 350,
                "fields": {
                    "title": {},
                    "body": {}
                }
            },
            "fields": ["author", "tags", "permlink", "category", "title", "body", "root_title", "root_author", "root_permlink", "created"]
        };
        const response = await fetch(url, {
            method: 'post',
            headers: new Headers({
                'Authorization': 'Basic ' + btoa($STM_Config.elastic_search.login + ':' + $STM_Config.elastic_search.password),
                'Content-Type': 'application/json'
            }),
            body: JSON.stringify(body)
        });
        if (response.ok) {
            const result = await response.json();
            //alert(JSON.stringify(result));
            this.setState({
                result
            })
        } else {
            console.error(response.status);
        }

        this.setState({
            page
        });
    };

    search = (e) => {
        if (e.type === 'keyup' && e.keyCode != 13) {
            return;
        }
        this.fetchSearch(1);
    };

    changePage = (page) => {
        this.fetchSearch(page);
    };

    _reloadWithSettings = (newState) => {
        this.setState(newState, () => {
            this.fetchSearch(1);
        });
    };

    handleWhereChange = (e) => {
        this._reloadWithSettings({
            where: e.target.value
        });
    };

    handleDateFromChange = (e) => {
        this._reloadWithSettings({
            dateFrom: e.target.value
        });
    };

    handleDateToChange = (e) => {
        this._reloadWithSettings({
            dateTo: e.target.value
        });
    };

    handleDateClear = (e) => {
        this._reloadWithSettings({
            dateFrom: '',
            dateTo: ''
        });
    };

    handleAuthorLookup = (value) => {
        golos.api.lookupAccounts(value, 6, (err, data) => {
            this.setState({
                authorLookup: data
            });
        });
    };
    handleAuthorSelect = (selectedList, selectedItem) => {
        document.getElementById('search_input').style.display = 'none';
        document.activeElement.blur();
        this._reloadWithSettings({
            author: selectedItem
        });
    };
    handleAuthorRemove = (selectedList, removedItem) => {
        document.getElementById('search_input').style.display = 'inline-block';
        this._reloadWithSettings({
            author: ''
        });
    };

    makeTag = (text) => {
        return /^[а-яё]/.test(text)
            ? '' + detransliterate(text, true)
            : text;
    };
    handleTagLookup = (value) => {
        setTimeout(() => {
            this.setState({
                tagLookup: [{text: value, value: this.makeTag(value)}]
            });
        }, 1);
    };
    handleTagSelect = (selectedList, selectedItem) => {
        this._reloadWithSettings({
            tags: [...this.state.tags, selectedItem.value]
        });
    };
    handleTagRemove = (selectedList, selectedItem) => {
        this._reloadWithSettings({
            tags: this.state.tags.filter(item => item !== selectedItem.value)
        });
    };

    render() {
        let results = [];
        let totalPosts = 0;
        let display = null;
        if (this.state.result) {
            results = this.state.result.hits.hits.map((hit) => {
                let category = hit.fields.category[0];

                let parts = hit._id.split('.');
                let author = parts[0];
                let permlink = parts.slice(1).join();
                let root_author = hit.fields.root_author[0];
                let root_permlink = hit.fields.root_permlink[0];

                let url = '/' + category + '/@' + root_author + '/' + root_permlink;

                let title = hit.highlight && hit.highlight.title;
                title = title ? title[0].split('</em> <em>').join(' ') : hit.fields.root_title[0];
                if (root_permlink !== permlink) {
                    title = 'RE: ' + title;
                    url += '#@' + author + '/' + permlink;
                }
                let body = hit.highlight && hit.highlight.body;
                body = body ? body[0].split('</em> <em>').join(' ') : truncate(hit.fields.body[0], {length: 200});

                if (this.state.author && author !== this.state.author) return null;

                return (<div className='golossearch-results'>
                        <Link to={url}><h6 dangerouslySetInnerHTML={{__html: title}}></h6></Link>
                        <Link to={url}><div style={{color: 'rgb(180, 180, 180)'}}>
                            <TimeAgoWrapper date={hit.fields.created[0]} />
                            &nbsp;—&nbsp;@
                            {hit.fields.author[0]}
                        </div></Link>
                        <div dangerouslySetInnerHTML={{__html: remarkableStripper.render(body)}}></div>
                        <br/>
                    </div>);
            });
            totalPosts = this.state.result.hits.total.value;
            display = (<div>
              <b>{tt('search.results')} {totalPosts}</b>
              <Pagination
                defaultPageSize={20}
                current={this.state.page}
                onShowSizeChange={this.onShowSizeChange}
                onChange={this.changePage}
                total={totalPosts}
                style={{ float: 'right', margin: 0 }}
              />
              <br/>
              <br/>
              {results}
              <Pagination
                defaultPageSize={20}
                current={this.state.page}
                onShowSizeChange={this.onShowSizeChange}
                onChange={this.changePage}
                total={totalPosts}
                style={{ float: 'right', margin: 0 }}
              />
              </div>);
        }
        return (<div className="App-search">
              <div className='esearch-box'>
                  <input className='esearch-input' placeholder={tt('search.placeholder')} type='text' onKeyUp={this.search} onChange={this.onChange} />
                    <select onChange={this.handleWhereChange}>
                        <option value={tt('search.where_posts')}>{tt('search.where_posts')}</option>
                        <option value={tt('search.where_comments')}>{tt('search.where_comments')}</option>
                        <option value={tt('search.where_anywhere')}>{tt('search.where_anywhere')}</option>
                    </select>
                    &nbsp;&nbsp;
                  <input type="submit" className="button" value={tt('g.search')} onClick={this.search} />
              </div>
              <div className='esearch-settings'>
                <input type='date' value={this.state.dateFrom} onChange={this.handleDateFromChange} />
                &nbsp;—&nbsp;
                <input type='date' value={this.state.dateTo} onChange={this.handleDateToChange} />
                &nbsp;&nbsp;
                {(this.state.dateFrom || this.state.dateTo) ? <span className='button small hollow esearch-btn-alltime' title={tt('search.alltime')} onClick={this.handleDateClear}>
                    <Icon name="cross" size="0_95x" />
                </span> : null}
                &nbsp;&nbsp;
                {Multiselect ? <Multiselect
                    className='esearch-author'
                    options={this.state.authorLookup}
                    isObject={false}
                    selectionLimit="3"
                    emptyRecordMsg={tt('g.author')}
                    closeOnSelect='true'
                    closeIcon="cancel"
                    placeholder={tt('g.author')}
                    selectedValues={this.state.author ? [this.state.author] : undefined}
                    onSearch={this.handleAuthorLookup}
                    onSelect={this.handleAuthorSelect}
                    onRemove={this.handleAuthorRemove}
                    /> : null}
                &nbsp;&nbsp;
                {Multiselect ? <Multiselect
                    className='esearch-tags'
                    options={this.state.tagLookup}
                    displayValue='text'
                    selectionLimit="3"
                    emptyRecordMsg='Тэги'
                    closeOnSelect='true'
                    closeIcon="cancel"
                    placeholder='Тэги'
                    onSearch={this.handleTagLookup}
                    onSelect={this.handleTagSelect}
                    onRemove={this.handleTagRemove}
                    /> : null}
              </div>
              {display}
              <br/>
              <br/>
              <hr/>
              {tt('search.search_in')}
              <a href={'https://yandex.ru/search/site/?searchid=2415103&text=' + this.state.query}>{tt('search.yandex')}</a>
              {tt('search.or')}
              <a href={'https://www.google.ru/search?lr=&q=' + this.state.query + ' site:golos.id'}>{tt('search.google')}</a>
              <br/>
              <br/>
          </div>);
    }
}


module.exports = {
    path: '/search(/:author)',
    component: Search
};