# In-memory Implementation of GraphDB


# Overview
GraphDB consists of two main parts: graphs and queries.

### Construction
- A graph contains vertices and edges, and provides access to query initializers like g.v()

### Query
- A query contains pipes, which make up a pipeline, and a virtual machine for processing pipelines.

### PipeTypes
- TBA

### Gremlins
- TBA

### Query Transformers
- TBA

### Aliases
- TBA

### Performance
- TBA

----
## Usage

```javascript

    V = [ {name: 'alice'}                                         // alice gets auto-_id (prolly 1)
        , {_id: 10, name: 'bob', hobbies: ['asdf', {x:3}]}] 
    E = [ {_out: 1, _in: 10, _label: 'knows'} ]
    g = graphDB.graph(V, E)
    
    g.addVertex({name: 'charlie', _id: 'charlie'})                // string ids are fine
    g.addVertex({name: 'delta', _id: '30'})                       // in fact they're all strings
    g.addEdge({_out: 10, _in: 30, _label: 'parent'})
    g.addEdge({_out: 10, _in: 'charlie', _label: 'knows'})
    g.v(1).out('knows').out().run()                               // returns [charlie, delta]
    
    q = g.v(1).out('knows').out().take(1)
    q.run()                                                       // returns [charlie]
    q.run()                                                       // returns [delta]  
    q.run()                                                       // returns []
```