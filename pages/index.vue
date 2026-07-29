<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { members, photoRows, principles, projects } from '~/data/site'

let revealObserver: IntersectionObserver | undefined

onMounted(() => {
  document.documentElement.classList.add('motion-ready')
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible')
        revealObserver?.unobserve(entry.target)
      }
    })
  }, { threshold: 0.14 })
  document.querySelectorAll('[data-reveal]').forEach((element) => revealObserver?.observe(element))
})

onUnmounted(() => {
  revealObserver?.disconnect()
  document.documentElement.classList.remove('motion-ready')
})
</script>

<template>
  <div>
    <div class="noise" aria-hidden="true" />
    <SiteHeader />
    <main id="top">
      <HeroPanel />
      <section id="about" class="manifesto" data-reveal>
        <p class="section-index">01 / ABOUT</p>
        <h2>让好奇心<br>有地方<span>落地。</span></h2>
        <div class="manifesto-text">
          <p>学校曾有信息奥赛团队，但算法与竞赛并不是每个人想走的路。ITEx 不刷竞赛题，也不把兴趣压进同一条赛道。</p>
          <p>我们是一群在校园里折腾电脑、做小工具、研究网络与创意表达的人。有人会修设备，有人写代码，有人做视觉，也有人只是想弄懂“它为什么这样运作”。</p>
          <p>这里没有标准答案，只有一起把问题变成作品的同伴。</p>
        </div>
        <div class="statement">KEEP IT<br>CURIOUS.</div>
      </section>
      <section class="club-proof" data-reveal>
        <div class="play-note">
          <p class="section-index">01.5 / PLAY, RESPONSIBLY</p>
          <h2>自由发挥，<br><span>立省￥50。</span></h2>
          <p>有些校园信息爱好者会对教学一体机感到好奇；不过，玩一体机被明确禁止，也有同学被叫到办公室并遭受罚款50元的威胁。</p>
          <p>ITEx 希望把这份好奇心带到获授权的维护、创作与试验中：在安全、负责的边界内，自由发挥每个人的技术特长与爱好。</p>
        </div>
        <div class="proof-stack">
          <article class="proof-card blue-card">
            <p class="card-label">CAMPUS COLLABORATION</p>
            <h3>学生维护<br>校园电教</h3>
            <p>与 <a href="https://smart.zznfzx.com" target="_blank" rel="noopener">南方中学电教委员交流网站</a>
              联动，结合双方技术优势，为校园设备维护提供学生视角的支持。</p><a href="https://smart.zznfzx.com" target="_blank" rel="noopener">访问
              smart.zznfzx.com ↗</a>
          </article>
          <article class="proof-card red-card">
            <p class="card-label">MEMBER MILESTONES</p>
            <h3>把作品<br>做到更远</h3>
            <ul>
              <li>2506 AbCd（副社长）<br>第 27 届中小学生数字素养提升实践活动省赛二等奖</li>
              <li>2505 xxt8582753（副社长）<br>第 27 届中小学生数字素养提升实践活动省赛一等奖，并进入国赛</li>
            </ul>
            <p>部分学生作品也在 <a href="https://smart.zznfzx.com" target="_blank" rel="noopener">南方中学电教委员专题网站</a> 展示。</p>
          </article>
        </div>
      </section>
      <section class="ip-culture" data-reveal>
        <div class="ip-copy">
          <p class="section-index">01.6 / CLUB CULTURE</p>
          <h2>认识一下<br><span>水原雫。</span></h2>
          <p class="ip-lead">她是 ITEx 的独立社团 IP，也是我们想留给每一位成员的一枚文化坐标。</p>
          <div class="trait-list">
            <div><b>开朗有活力</b><span>来自高中生特有的热情、好奇和行动力。</span></div>
            <div><b>稳重且可靠</b><span>面对设备、项目与伙伴，认真把每一件小事做好。</span></div>
            <div><b>属于同学们</b><span>用创作、作品和共同记忆，让社团有可被看见的样子。</span></div>
          </div>
        </div>
        <div class="merch-display">
          <p class="merch-label">ITEx / CLUB GOODS</p>
          <div class="pin-stage"><i class="pin-shadow" /><i class="pin-rim" /><img src="/images/shizuku-pin.png"
              alt="水原雫社团吧唧样图" /></div>
          <div class="merch-note"><b>新成员欢迎礼</b><span>我们已经做出了吧唧周边，会在部分活动中免费赠送给新社员。</span></div>
        </div>
      </section>
      <section class="team-section" data-reveal>
        <div class="team-heading">
          <p class="section-index">01.7 / PEOPLE</p>
          <h2>一起把<br><span>想法做出来。</span></h2>
          <p>社团由不同方向的同学共同维护。每个人都能带来新的视角。</p>
        </div>
        <div class="team-content">
          <div class="member-grid">
            <article v-for="member in members" :key="member.name" class="member-card"><img :src="member.avatar"
                :alt="`${member.name} 的头像`">
              <div>
                <p>{{ member.role }}</p>
                <h3>{{ member.name }}</h3><span v-if="member.className">{{ member.className }}</span>
              </div>
            </article>
          </div>
          <aside class="speaker-note">
            <p class="section-index">THE STAGE IS YOURS</p>
            <h3>讲台属于<br>每一个人。</h3>
            <p>只要你愿意，就可以上台分享：讲一节课、展示一次尝试，或把自己会的东西带给所有人。</p><a href="https://qm.qq.com/q/Ypgmr1rfyI" target="_blank"
              rel="noopener">来群里提议分享 ↗</a>
          </aside>
        </div>
      </section>
      <section class="photo-section" data-reveal>
        <div class="photo-heading">
          <p class="section-index">01.8 / IN THE MOMENT</p>
          <h2>活动<br><span>现场。</span></h2>
          <p>从教室到活动现场，所有实践都留下真实的瞬间。</p>
        </div>
        <div class="photo-wall">
          <div v-for="(row, rowIndex) in photoRows" :key="rowIndex" class="photo-row"
            :class="`photo-row--${rowIndex + 1}`">
            <figure v-for="photo in row" :key="photo.order" class="photo-card" :style="{ '--ratio': photo.ratio }"><img
                :src="photo.src" :alt="photo.alt">
            </figure>
          </div>
        </div>
      </section>
      <section id="work" class="work" data-reveal>
        <div class="section-heading">
          <p class="section-index">02 / SKILL MAP</p>
          <h2>不止一道题<br><span>还有很多种路</span></h2>
          <p class="mono-note">不设单一技能栈<br>从兴趣开始动手</p>
        </div>
        <div class="project-grid">
          <ProjectCard v-for="project in projects" :key="project.number" :project="project" />
        </div>
      </section>
      <section class="rules" data-reveal>
        <p class="section-index">03 / GROUND RULES</p>
        <div class="rules-title">
          <h2>我们相信<br><span>这些事</span></h2>
          <div>✱</div>
        </div>
        <ol>
          <li v-for="rule in principles" :key="rule[0]"><b>{{ rule[0] }}</b><span>{{ rule[1] }}</span><small>{{ rule[2]
          }}</small></li>
        </ol>
      </section>
      <section id="join" class="join" data-reveal>
        <div class="join-label">04 / OPEN INVITATION</div>
        <div class="join-main">
          <h2>带着你的<br><em>问题</em>来。</h2>
          <p>不需要履历，不限技能栈。<br>会不会都没关系；想做点东西，就来一起试试。<br>入社不收取任何费用，具体活动时间和地点将在群内公布。</p><a class="big-button"
            href="https://qm.qq.com/q/Ypgmr1rfyI" target="_blank" rel="noopener">加入 QQ 群 · 1076741511 <span>↗</span></a>
        </div>
        <div class="join-side"><span>南方中学</span><b>ITEx<br>CLUB</b><span>STUDENT RUN / NON-OFFICIAL</span></div>
      </section>
    </main>
    <SiteFooter />
  </div>
</template>
