function load(key) {
  var data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}
function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

var users = load('blog_users');
var posts = load('blog_posts');
var follows = load('blog_follows');
var comments = load('blog_comments');
var requests = load('blog_requests');
var currentUserId = localStorage.getItem('blog_currentUser') || null;

function saveAll() {
  save('blog_users', users);
  save('blog_posts', posts);
  save('blog_follows', follows);
  save('blog_comments', comments);
  save('blog_requests', requests);
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getUser(id) {
  return users.find(function (u) { return u.id === id; });
}

function currentUser() {
  return getUser(currentUserId);
}

function registerUser() {
  var username = document.getElementById('regUsername').value.trim();
  var password = document.getElementById('regPassword').value;
  var errorBox = document.getElementById('regError');
  errorBox.textContent = '';
  if (!username || !password) {
    errorBox.textContent = 'Заполните оба поля.';
    return;
  }
  var exists = users.find(function (u) { return u.username === username; });
  if (exists) {
    errorBox.textContent = 'Такой пользователь уже существует.';
    return;
  }
  var user = { id: genId(), username: username, password: password };
  users.push(user);
  saveAll();
  currentUserId = user.id;
  localStorage.setItem('blog_currentUser', currentUserId);
  enterApp();
}

function loginUser() {
  var username = document.getElementById('loginUsername').value.trim();
  var password = document.getElementById('loginPassword').value;
  var errorBox = document.getElementById('loginError');
  errorBox.textContent = '';
  var user = users.find(function (u) { return u.username === username && u.password === password; });
  if (!user) {
    errorBox.textContent = 'Неверное имя пользователя или пароль.';
    return;
  }
  currentUserId = user.id;
  localStorage.setItem('blog_currentUser', currentUserId);
  enterApp();
}

function logoutUser() {
  currentUserId = null;
  localStorage.removeItem('blog_currentUser');
  document.getElementById('mainNav').classList.add('hidden');
  document.getElementById('userbar').classList.add('hidden');
  document.getElementById('authView').classList.remove('hidden');
  hideAllViews();
}

function enterApp() {
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('mainNav').classList.remove('hidden');
  document.getElementById('userbar').classList.remove('hidden');
  renderUserbar();
  showView('feed');
}

function renderUserbar() {
  var user = currentUser();
  document.getElementById('userbar').innerHTML =
    'Вы вошли как <b>' + user.username + '</b> <button onclick="logoutUser()">Выйти</button>';
}

function hideAllViews() {
  ['feedView', 'allView', 'myView', 'usersView', 'postView'].forEach(function (id) {
    document.getElementById(id).classList.add('hidden');
  });
}

function showView(name) {
  hideAllViews();
  document.querySelectorAll('#mainNav button').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.view === name);
  });
  if (name === 'feed') renderFeed();
  if (name === 'all') renderAllPosts();
  if (name === 'my') renderMyPosts();
  if (name === 'users') renderUsers();
}

document.getElementById('mainNav').addEventListener('click', function (e) {
  if (e.target.dataset.view) showView(e.target.dataset.view);
});

function allTagsFromList(list) {
  var tags = [];
  list.forEach(function (p) {
    p.tags.forEach(function (t) {
      if (tags.indexOf(t) === -1) tags.push(t);
    });
  });
  return tags;
}

function filterAndSort(list, tagFilterId, sortSelectId) {
  var tagFilter = document.getElementById(tagFilterId).value;
  var sortMode = document.getElementById(sortSelectId).value;
  var result = list.slice();
  if (tagFilter) {
    result = result.filter(function (p) { return p.tags.indexOf(tagFilter) !== -1; });
  }
  if (sortMode === 'date_desc') {
    result.sort(function (a, b) { return b.createdAt - a.createdAt; });
  } else if (sortMode === 'date_asc') {
    result.sort(function (a, b) { return a.createdAt - b.createdAt; });
  } else if (sortMode === 'tag') {
    result.sort(function (a, b) {
      var ta = a.tags[0] || '';
      var tb = b.tags[0] || '';
      return ta.localeCompare(tb);
    });
  }
  return result;
}

function renderFilters(containerId, list, onChange) {
  var tags = allTagsFromList(list);
  var html = '<div class="filters">';
  html += '<select id="' + containerId + '_tag" onchange="' + onChange + '()"><option value="">Все теги</option>';
  tags.forEach(function (t) {
    html += '<option value="' + t + '">' + t + '</option>';
  });
  html += '</select>';
  html += '<select id="' + containerId + '_sort" onchange="' + onChange + '()">';
  html += '<option value="date_desc">Сначала новые</option>';
  html += '<option value="date_asc">Сначала старые</option>';
  html += '<option value="tag">По тегу</option>';
  html += '</select></div>';
  return html;
}

function canViewFullPost(post) {
  if (post.authorId === currentUserId) return true;
  if (post.visibility === 'public') return true;
  var req = requests.find(function (r) {
    return r.postId === post.id && r.requesterId === currentUserId && r.status === 'approved';
  });
  return !!req;
}

function postCardHtml(post, showManage) {
  var author = getUser(post.authorId);
  var full = canViewFullPost(post);
  var html = '<div class="card">';
  html += '<div class="meta">' + author.username + ' • ' + new Date(post.createdAt).toLocaleString() +
    (post.visibility === 'private' ? ' • закрытый пост' : '') + '</div>';
  html += '<h3 style="cursor:pointer" onclick="openPost(\'' + post.id + '\')">' + escapeHtml(post.title) + '</h3>';
  post.tags.forEach(function (t) {
    html += '<span class="tag">' + escapeHtml(t) + '</span>';
  });
  if (full) {
    html += '<p>' + escapeHtml(post.content.slice(0, 180)) + (post.content.length > 180 ? '...' : '') + '</p>';
  } else {
    html += '<div class="lock">Пост доступен только по запросу.</div>';
    var pending = requests.find(function (r) {
      return r.postId === post.id && r.requesterId === currentUserId;
    });
    if (pending && pending.status === 'pending') {
      html += '<p class="small">Запрос отправлен, ожидает одобрения.</p>';
    } else if (!pending) {
      html += '<button class="secondary" onclick="requestAccess(\'' + post.id + '\')">Запросить доступ</button>';
    }
  }
  html += '<div style="margin-top:8px"><button class="secondary" onclick="openPost(\'' + post.id + '\')">Открыть</button>';
  if (showManage) {
    html += '<button class="secondary" onclick="startEditPost(\'' + post.id + '\')">Редактировать</button>';
    html += '<button class="danger" onclick="deletePost(\'' + post.id + '\')">Удалить</button>';
  }
  html += '</div></div>';
  return html;
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderFeed() {
  var view = document.getElementById('feedView');
  view.classList.remove('hidden');
  var followingIds = follows.filter(function (f) { return f.followerId === currentUserId; })
    .map(function (f) { return f.followingId; });
  var feedPosts = posts.filter(function (p) {
    return followingIds.indexOf(p.authorId) !== -1;
  });
  var html = '<h2>Лента подписок</h2>';
  if (followingIds.length === 0) {
    html += '<p class="small">Вы пока ни на кого не подписаны. Перейдите во вкладку "Пользователи".</p>';
    view.innerHTML = html;
    return;
  }
  if (feedPosts.length === 0) {
    html += '<p class="small">Люди, на которых вы подписаны, пока не публиковали постов.</p>';
    view.innerHTML = html;
    return;
  }
  html += renderFilters('feed', feedPosts, 'renderFeed');
  view.innerHTML = html;
  var filtered = filterAndSort(feedPosts, 'feed_tag', 'feed_sort');
  filtered.forEach(function (p) {
    view.innerHTML += postCardHtml(p, false);
  });
}

function renderAllPosts() {
  var view = document.getElementById('allView');
  view.classList.remove('hidden');
  var publicPosts = posts.filter(function (p) { return p.visibility === 'public' || p.authorId === currentUserId; });
  var html = '<h2>Все публичные посты</h2>';
  if (publicPosts.length === 0) {
    html += '<p class="small">Публичных постов пока нет.</p>';
    view.innerHTML = html;
    return;
  }
  html += renderFilters('all', publicPosts, 'renderAllPosts');
  view.innerHTML = html;
  var filtered = filterAndSort(publicPosts, 'all_tag', 'all_sort');
  filtered.forEach(function (p) {
    view.innerHTML += postCardHtml(p, false);
  });
}

function renderMyPosts() {
  var view = document.getElementById('myView');
  view.classList.remove('hidden');
  var myPosts = posts.filter(function (p) { return p.authorId === currentUserId; });
  var html = '<h2>Написать пост</h2>';
  html += '<div class="card">';
  html += '<input id="newTitle" placeholder="Заголовок">';
  html += '<textarea id="newContent" placeholder="Текст поста"></textarea>';
  html += '<input id="newTags" placeholder="Теги через запятую">';
  html += '<select id="newVisibility"><option value="public">Публичный</option><option value="private">Только по запросу</option></select>';
  html += '<button class="primary" onclick="createPost()">Опубликовать</button>';
  html += '</div>';
  html += '<h2>Мои посты</h2>';
  view.innerHTML = html;
  if (myPosts.length === 0) {
    view.innerHTML += '<p class="small">Вы ещё не написали ни одного поста.</p>';
  } else {
    myPosts.sort(function (a, b) { return b.createdAt - a.createdAt; });
    myPosts.forEach(function (p) {
      view.innerHTML += postCardHtml(p, true);
    });
  }
}

function createPost() {
  var title = document.getElementById('newTitle').value.trim();
  var content = document.getElementById('newContent').value.trim();
  var tagsRaw = document.getElementById('newTags').value.trim();
  var visibility = document.getElementById('newVisibility').value;
  if (!title || !content) {
    alert('Заполните заголовок и текст поста.');
    return;
  }
  var tags = tagsRaw ? tagsRaw.split(',').map(function (t) { return t.trim(); }).filter(Boolean) : [];
  var post = {
    id: genId(),
    authorId: currentUserId,
    title: title,
    content: content,
    tags: tags,
    visibility: visibility,
    createdAt: Date.now()
  };
  posts.push(post);
  saveAll();
  renderMyPosts();
}

function startEditPost(postId) {
  var post = posts.find(function (p) { return p.id === postId; });
  var view = document.getElementById('myView');
  var html = '<h2>Редактирование поста</h2>';
  html += '<div class="card">';
  html += '<input id="editTitle" value="' + escapeHtml(post.title) + '">';
  html += '<textarea id="editContent">' + escapeHtml(post.content) + '</textarea>';
  html += '<input id="editTags" value="' + post.tags.join(', ') + '">';
  html += '<select id="editVisibility"><option value="public"' + (post.visibility === 'public' ? ' selected' : '') + '>Публичный</option>';
  html += '<option value="private"' + (post.visibility === 'private' ? ' selected' : '') + '>Только по запросу</option></select>';
  html += '<button class="primary" onclick="saveEditPost(\'' + postId + '\')">Сохранить</button>';
  html += '<button class="secondary" onclick="renderMyPosts()">Отмена</button>';
  html += '</div>';
  view.innerHTML = html;
}

function saveEditPost(postId) {
  var post = posts.find(function (p) { return p.id === postId; });
  post.title = document.getElementById('editTitle').value.trim();
  post.content = document.getElementById('editContent').value.trim();
  post.tags = document.getElementById('editTags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
  post.visibility = document.getElementById('editVisibility').value;
  saveAll();
  renderMyPosts();
}

function deletePost(postId) {
  if (!confirm('Удалить пост?')) return;
  posts = posts.filter(function (p) { return p.id !== postId; });
  comments = comments.filter(function (c) { return c.postId !== postId; });
  requests = requests.filter(function (r) { return r.postId !== postId; });
  saveAll();
  renderMyPosts();
}

function renderUsers() {
  var view = document.getElementById('usersView');
  view.classList.remove('hidden');
  var html = '<h2>Пользователи</h2>';
  var others = users.filter(function (u) { return u.id !== currentUserId; });
  if (others.length === 0) {
    html += '<p class="small">Других пользователей пока нет.</p>';
  }
  others.forEach(function (u) {
    var isFollowing = follows.some(function (f) {
      return f.followerId === currentUserId && f.followingId === u.id;
    });
    var postsCount = posts.filter(function (p) { return p.authorId === u.id; }).length;
    html += '<div class="card">';
    html += '<b>' + escapeHtml(u.username) + '</b> <span class="small">(' + postsCount + ' постов)</span><br>';
    if (isFollowing) {
      html += '<button class="secondary" onclick="unfollowUser(\'' + u.id + '\')">Отписаться</button>';
    } else {
      html += '<button class="primary" onclick="followUser(\'' + u.id + '\')">Подписаться</button>';
    }
    html += '</div>';
  });
  view.innerHTML = html;
}

function followUser(userId) {
  follows.push({ followerId: currentUserId, followingId: userId });
  saveAll();
  renderUsers();
}

function unfollowUser(userId) {
  follows = follows.filter(function (f) {
    return !(f.followerId === currentUserId && f.followingId === userId);
  });
  saveAll();
  renderUsers();
}

function requestAccess(postId) {
  requests.push({ id: genId(), postId: postId, requesterId: currentUserId, status: 'pending' });
  saveAll();
  openPost(postId);
}

function approveRequest(requestId) {
  var req = requests.find(function (r) { return r.id === requestId; });
  req.status = 'approved';
  saveAll();
  openPost(req.postId);
}

function openPost(postId) {
  hideAllViews();
  document.querySelectorAll('#mainNav button').forEach(function (btn) {
    btn.classList.remove('active');
  });
  var post = posts.find(function (p) { return p.id === postId; });
  var author = getUser(post.authorId);
  var view = document.getElementById('postView');
  view.classList.remove('hidden');
  var full = canViewFullPost(post);
  var html = '<button class="secondary" onclick="showView(\'all\')">Назад</button>';
  html += '<div class="card">';
  html += '<div class="meta">' + author.username + ' • ' + new Date(post.createdAt).toLocaleString() + '</div>';
  html += '<h2>' + escapeHtml(post.title) + '</h2>';
  post.tags.forEach(function (t) {
    html += '<span class="tag">' + escapeHtml(t) + '</span>';
  });
  if (full) {
    html += '<p>' + escapeHtml(post.content) + '</p>';
  } else {
    html += '<div class="lock">Это закрытый пост, доступный только по запросу автора.</div>';
    var pending = requests.find(function (r) {
      return r.postId === post.id && r.requesterId === currentUserId;
    });
    if (!pending) {
      html += '<button class="secondary" onclick="requestAccess(\'' + post.id + '\')">Запросить доступ</button>';
    } else if (pending.status === 'pending') {
      html += '<p class="small">Запрос отправлен, ожидает одобрения автора.</p>';
    }
  }
  if (post.authorId === currentUserId && post.visibility === 'private') {
    var pendingRequests = requests.filter(function (r) { return r.postId === post.id && r.status === 'pending'; });
    if (pendingRequests.length > 0) {
      html += '<h4>Запросы на доступ</h4>';
      pendingRequests.forEach(function (r) {
        var requester = getUser(r.requesterId);
        html += '<div class="small">' + escapeHtml(requester.username) +
          ' <button class="secondary" onclick="approveRequest(\'' + r.id + '\')">Одобрить</button></div>';
      });
    }
  }
  html += '</div>';

  html += '<div class="card"><h3>Комментарии</h3>';
  if (full) {
    html += '<div id="commentsList">' + renderComments(post.id) + '</div>';
    html += '<textarea id="newComment" placeholder="Ваш комментарий"></textarea>';
    html += '<button class="primary" onclick="addComment(\'' + post.id + '\')">Отправить</button>';
  } else {
    html += '<p class="small">Комментарии доступны только тем, кто может видеть пост.</p>';
  }
  html += '</div>';

  view.innerHTML = html;
}

function renderComments(postId) {
  var postComments = comments.filter(function (c) { return c.postId === postId; });
  if (postComments.length === 0) {
    return '<p class="small">Комментариев пока нет.</p>';
  }
  var html = '';
  postComments.sort(function (a, b) { return a.createdAt - b.createdAt; });
  postComments.forEach(function (c) {
    var author = getUser(c.authorId);
    html += '<div class="comment"><b>' + escapeHtml(author.username) + ':</b> ' + escapeHtml(c.text) + '</div>';
  });
  return html;
}

function addComment(postId) {
  var text = document.getElementById('newComment').value.trim();
  if (!text) return;
  comments.push({ id: genId(), postId: postId, authorId: currentUserId, text: text, createdAt: Date.now() });
  saveAll();
  openPost(postId);
}

if (currentUserId && getUser(currentUserId)) {
  enterApp();
}